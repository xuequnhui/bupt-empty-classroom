const dataset = require('../backend/data/data.json')

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
  const parsed = dataset && typeof dataset === 'object' ? dataset : {}
  return Array.isArray(parsed.classrooms) ? parsed.classrooms : []
}

function buildDatasetIndex(rawClassrooms) {
  const roomSetByBuilding = new Map()
  const scheduleByRoomAndDay = new Map()
  const buildingSetByCampus = new Map()
  let latestUpdatedAt = null

  rawClassrooms.forEach((entry) => {
    const campus = normalizeCampus(entry.campus)
    const building = entry.building
    const room = entry.roomName
    const dayOfWeek = entry.dayOfWeek
    const updatedAt = typeof entry.updatedAt === 'string' ? Date.parse(entry.updatedAt) : Number.NaN

    if (!campus || !building || !room || !dayOfWeek) {
      return
    }

    if (!Number.isNaN(updatedAt)) {
      if (!latestUpdatedAt || updatedAt > Date.parse(latestUpdatedAt)) {
        latestUpdatedAt = new Date(updatedAt).toISOString()
      }
    }

    if (!buildingSetByCampus.has(campus)) {
      buildingSetByCampus.set(campus, new Set())
    }
    buildingSetByCampus.get(campus).add(building)

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
    latestUpdatedAt,
    roomSetByBuilding,
    scheduleByRoomAndDay,
    buildingSetByCampus,
  }
}

const datasetIndex = buildDatasetIndex(loadRawClassroomData())

const campusBuildingMap = {
  xitucheng: {
    label: '西土城校区',
    buildings: [],
  },
  shahe: {
    label: '沙河校区',
    buildings: [],
  },
}

function getWeekdayLabel(date) {
  const value = new Date(`${date}T00:00:00`)
  if (Number.isNaN(value.getTime())) {
    return null
  }
  return weekdayLabels[value.getDay()]
}

function deriveFloor(roomName) {
  const matches = String(roomName).match(/(\d{3,4})(?!.*\d)/)
  if (!matches) return '--'
  const floor = Number(matches[1].slice(0, 1))
  return Number.isNaN(floor) ? '--' : `${floor}F`
}

function deriveCapacity(roomName) {
  const matches = String(roomName).match(/(\d{3,4})(?!.*\d)/)
  if (!matches) return 60
  const roomNumber = Number(matches[1])
  if (Number.isNaN(roomNumber)) return 60
  if (roomNumber >= 900) return 40
  if (roomNumber >= 500) return 60
  if (roomNumber >= 300) return 80
  if (roomNumber >= 200) return 70
  return 120
}

function buildInventory(campus, building) {
  const buildingKey = `${campus}::${building}`
  const roomSet = datasetIndex.roomSetByBuilding.get(buildingKey)
  const rooms = roomSet ? Array.from(roomSet) : []
  return rooms.sort((left, right) => String(left).localeCompare(String(right), 'zh-CN', { numeric: true }))
}

function getBuildingsForCampus(campus) {
  const buildingSet = datasetIndex.buildingSetByCampus.get(campus)
  const buildings = buildingSet ? Array.from(buildingSet) : []
  if (buildings.length > 0) {
    return buildings.sort((left, right) => String(left).localeCompare(String(right), 'zh-CN', { numeric: true }))
  }

  const fallback = campusBuildingMap[campus]?.buildings ?? []
  return fallback
}

function getFloorOptions({ campus, building }) {
  const inventory = buildInventory(campus, building)
  const floors = inventory.map((roomName) => deriveFloor(roomName))
  const uniqueFloors = [...new Set(floors.filter(Boolean).filter((floor) => floor !== '--'))]
  return uniqueFloors.sort((left, right) => String(left).localeCompare(String(right), 'zh-CN', { numeric: true }))
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

function jsonResponse(payload, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      ...headers,
    },
  })
}

async function handleFetch(request) {
  const url = new URL(request.url)

  if (request.method === 'OPTIONS') {
    return jsonResponse({ ok: true }, { status: 204 })
  }

  if (request.method !== 'GET') {
    return jsonResponse({ success: false, message: '仅支持 GET 请求' }, { status: 405 })
  }

  const pathname = url.pathname

  if (pathname.endsWith('/health') || pathname.endsWith('/api/health')) {
    return jsonResponse({ success: true, message: '服务运行正常' })
  }

  if (pathname.includes('/buildings')) {
    const campus = url.searchParams.get('campus') || 'xitucheng'
    const campusCode = normalizeCampus(campus)
    const campusInfo = campusBuildingMap[campusCode] ?? { label: campus, buildings: [] }

    if (!campusInfo) {
      return jsonResponse({ success: false, message: '未找到对应校区' }, { status: 400 })
    }

    return jsonResponse({
      success: true,
      campus: campusCode,
      label: campusInfo.label,
      buildings: getBuildingsForCampus(campusCode),
    })
  }

  if (pathname.includes('/floors')) {
    const campus = url.searchParams.get('campus') || 'xitucheng'
    const campusCode = normalizeCampus(campus)
    const building = url.searchParams.get('building')

    if (!building) {
      return jsonResponse({ success: false, message: '请提供教学楼参数' }, { status: 400 })
    }

    if (!campusBuildingMap[campusCode]) {
      return jsonResponse({ success: false, message: '校区参数不正确' }, { status: 400 })
    }

    const floors = getFloorOptions({ campus: campusCode, building })
    return jsonResponse({ success: true, campus: campusCode, building, floors })
  }

  if (pathname.includes('/availability')) {
    const campus = url.searchParams.get('campus') || 'xitucheng'
    const campusCode = normalizeCampus(campus)
    const date = url.searchParams.get('date')
    const building = url.searchParams.get('building')
    const floor = url.searchParams.get('floor') || ''
    const timeSlots = url.searchParams.getAll('timeSlot').filter(Boolean)

    if (!date || !building || timeSlots.length === 0) {
      return jsonResponse(
        { success: false, message: '请完整提供校区、日期、教学楼和至少一个时间段' },
        { status: 400 },
      )
    }

    if (!campusBuildingMap[campusCode]) {
      return jsonResponse({ success: false, message: '校区参数不正确' }, { status: 400 })
    }

    const weekdayLabel = getWeekdayLabel(date)
    if (!weekdayLabel) {
      return jsonResponse({ success: false, message: '日期格式不正确' }, { status: 400 })
    }

    const inventory = buildInventory(campusCode, building)
      .map((roomName) => {
        const roomDayKey = `${campusCode}::${building}::${roomName}::${weekdayLabel}`
        const scheduleRecord = datasetIndex.scheduleByRoomAndDay.get(roomDayKey)
        const occupiedDetails = []

        const isAvailable = timeSlots.every((timeSlot) => {
          const sectionCode = timeSlotSectionMap[timeSlot]
          if (!sectionCode) return true
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
        const derivedFloor = deriveFloor(roomName)

        return {
          room: roomName,
          status: isAvailable ? 'available' : 'busy',
          capacity: deriveCapacity(roomName),
          floor: derivedFloor === '--' ? '' : derivedFloor,
          description: buildDescription({
            isAvailable,
            timeSlots,
            occupiedDetails: uniqueDetails,
            hasScheduleRecord: Boolean(scheduleRecord),
          }),
        }
      })
      .filter((room) => (!floor ? true : room.floor === floor))

    const available = inventory.filter((room) => room.status === 'available').length
    const busy = inventory.length - available

    return jsonResponse({
      success: true,
      message: '查询成功',
      lastUpdatedAt: datasetIndex.latestUpdatedAt,
      query: {
        campus: campusBuildingMap[campusCode]?.label ?? campusCode,
        campusCode,
        building,
        floor: floor || '全部楼层',
        date,
        timeSlots,
      },
      summary: {
        total: inventory.length,
        available,
        busy,
      },
      classrooms: inventory,
    })
  }

  return jsonResponse({ success: true, message: 'API is alive', path: pathname })
}

module.exports = {
  fetch: handleFetch,
}
