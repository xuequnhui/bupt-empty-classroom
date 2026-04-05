const fs = require('fs')
const path = require('path')

const dataFilePath = path.join(__dirname, 'data.json')

const weekdayLabels = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const timeSlotSectionMap = {
  '08:00-08:45': '01',
  '08:50-09:35': '02',
  '09:50-10:35': '03',
  '10:40-11:25': '04',
  '11:30-12:15': '05',
  '13:00-13:45': '06',
  '13:50-14:35': '07',
  '14:45-15:30': '08',
  '15:40-16:25': '09',
  '16:35-17:20': '10',
  '17:25-18:10': '11',
  '18:30-19:15': '12',
  '19:20-20:05': '13',
  '20:10-20:55': '14',
}

const campusAliasMap = {
  xitucheng: 'xitucheng',
  '西土城校区': 'xitucheng',
  '校本部': 'xitucheng',
  shahe: 'shahe',
  '沙河校区': 'shahe',
}

function normalizeCampus(value) {
  return campusAliasMap[value] ?? value
}

function normalizeSection(value) {
  return String(value).padStart(2, '0')
}

function loadRawClassroomData() {
  try {
    const fileContent = fs.readFileSync(dataFilePath, 'utf8')
    const parsed = JSON.parse(fileContent)
    return Array.isArray(parsed.classrooms) ? parsed.classrooms : []
  } catch {
    return []
  }
}

function buildDatasetIndex(rawClassrooms) {
  const roomSetByBuilding = new Map()
  const scheduleByRoomAndDay = new Map()

  rawClassrooms.forEach((entry) => {
    const campus = normalizeCampus(entry.campus)
    const building = entry.building
    const room = entry.roomName
    const dayOfWeek = entry.dayOfWeek

    if (!campus || !building || !room || !dayOfWeek) {
      return
    }

    const buildingKey = `${campus}::${building}`
    const roomDayKey = `${campus}::${building}::${room}::${dayOfWeek}`

    if (!roomSetByBuilding.has(buildingKey)) {
      roomSetByBuilding.set(buildingKey, new Set())
    }

    roomSetByBuilding.get(buildingKey).add(room)

    const sectionMap = new Map()

    ;(entry.sections ?? []).forEach((sectionEntry) => {
      sectionMap.set(normalizeSection(sectionEntry.section), {
        occupied: Boolean(sectionEntry.occupied),
        details: sectionEntry.details ?? '',
      })
    })

    scheduleByRoomAndDay.set(roomDayKey, sectionMap)
  })

  return {
    roomSetByBuilding,
    scheduleByRoomAndDay,
  }
}

const datasetIndex = buildDatasetIndex(loadRawClassroomData())

function getWeekdayLabel(date) {
  const value = new Date(`${date}T00:00:00`)

  if (Number.isNaN(value.getTime())) {
    return null
  }

  return weekdayLabels[value.getDay()]
}

function deriveFloor(roomName) {
  const matches = roomName.match(/(\d{3,4})(?!.*\d)/)

  if (!matches) {
    return '--'
  }

  const floor = Number(matches[1].slice(0, 1))
  return Number.isNaN(floor) ? '--' : `${floor}F`
}

function deriveCapacity(roomName) {
  const matches = roomName.match(/(\d{3,4})(?!.*\d)/)

  if (!matches) {
    return 60
  }

  const roomNumber = Number(matches[1])

  if (Number.isNaN(roomNumber)) {
    return 60
  }

  if (roomNumber >= 900) {
    return 40
  }

  if (roomNumber >= 500) {
    return 60
  }

  if (roomNumber >= 300) {
    return 80
  }

  if (roomNumber >= 200) {
    return 70
  }

  return 120
}

function buildInventory(campus, building, classroomTemplate) {
  const buildingKey = `${campus}::${building}`
  const dataRooms = Array.from(datasetIndex.roomSetByBuilding.get(buildingKey) ?? [])
  const allRooms = dataRooms.length > 0 ? dataRooms : (classroomTemplate[building] ?? []).map((room) => room.room)

  return allRooms.sort((left, right) => left.localeCompare(right, 'zh-CN', { numeric: true }))
}

function getFloorOptions({ campus, building }, { classroomTemplate }) {
  const inventory = buildInventory(campus, building, classroomTemplate)
  const templateRoomMap = new Map((classroomTemplate[building] ?? []).map((room) => [room.room, room]))
  const floors = inventory.map((roomName) => templateRoomMap.get(roomName)?.floor ?? deriveFloor(roomName))
  const uniqueFloors = [...new Set(floors.filter(Boolean).filter((floor) => floor !== '--'))]

  return uniqueFloors.sort((left, right) => left.localeCompare(right, 'zh-CN', { numeric: true }))
}

function buildDescription({ isAvailable, timeSlots, occupiedDetails, hasScheduleRecord }) {
  if (isAvailable) {
    return hasScheduleRecord
      ? `所选 ${timeSlots.length} 个节次均无排课，可直接使用。`
      : `该教室在本学期数据中未提及，默认视为长期空闲。`
  }

  if (occupiedDetails.length > 0) {
    return occupiedDetails.join('；')
  }

  return '所选节次内存在排课，不满足全时段空闲条件。'
}

function buildRealQueryResult({ campus, building, date, floor, timeSlots }, { campusBuildingMap, classroomTemplate }) {
  const weekdayLabel = getWeekdayLabel(date)
  const templateRoomMap = new Map((classroomTemplate[building] ?? []).map((room) => [room.room, room]))
  const inventory = buildInventory(campus, building, classroomTemplate)

  const classrooms = inventory.map((roomName) => {
    const roomDayKey = `${campus}::${building}::${roomName}::${weekdayLabel}`
    const scheduleRecord = datasetIndex.scheduleByRoomAndDay.get(roomDayKey)
    const occupiedDetails = []

    const isAvailable = timeSlots.every((timeSlot) => {
      const sectionCode = timeSlotSectionMap[timeSlot]

      if (!sectionCode) {
        return true
      }

      const sectionRecord = scheduleRecord?.get(sectionCode)

      if (sectionRecord?.occupied) {
        if (sectionRecord.details) {
          occupiedDetails.push(sectionRecord.details)
        }

        return false
      }

      return true
    })

    const uniqueDetails = [...new Set(occupiedDetails)]
    const templateRoom = templateRoomMap.get(roomName)

    return {
      room: roomName,
      status: isAvailable ? 'available' : 'busy',
      capacity: templateRoom?.capacity ?? deriveCapacity(roomName),
      floor: templateRoom?.floor ?? deriveFloor(roomName),
      description: buildDescription({
        isAvailable,
        timeSlots,
        occupiedDetails: uniqueDetails,
        hasScheduleRecord: Boolean(scheduleRecord),
      }),
    }
  }).filter((room) => !floor || room.floor === floor)

  const available = classrooms.filter((room) => room.status === 'available').length
  const busy = classrooms.length - available

  return {
    success: true,
    message: '查询成功',
    query: {
      campus: campusBuildingMap[campus]?.label ?? campus,
      campusCode: campus,
      building,
      floor: floor || '全部楼层',
      date,
      timeSlots,
    },
    summary: {
      total: classrooms.length,
      available,
      busy,
    },
    classrooms,
  }
}

module.exports = {
  buildRealQueryResult,
  getFloorOptions,
}
