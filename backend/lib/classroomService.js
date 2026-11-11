// 课表数据索引与查询核心逻辑。
// 本地 Express（backend/server.js）与 Vercel Serverless（api/[...route].js）共用，
// 避免业务逻辑双份维护导致行为漂移。

const WEEKDAY_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const TIME_SLOT_SECTION_MAP = {
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

const CAMPUS_ALIAS_MAP = {
  xitucheng: 'xitucheng',
  '西土城校区': 'xitucheng',
  '校本部': 'xitucheng',
  shahe: 'shahe',
  '沙河校区': 'shahe',
}

const CAMPUS_LABELS = {
  xitucheng: '西土城校区',
  shahe: '沙河校区',
}

function normalizeCampus(value) {
  return CAMPUS_ALIAS_MAP[value] ?? value
}

function isKnownCampus(value) {
  return Boolean(CAMPUS_LABELS[normalizeCampus(value)])
}

function normalizeSection(value) {
  return String(value).padStart(2, '0')
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

function getWeekdayLabel(date) {
  const value = new Date(`${date}T00:00:00`)
  if (Number.isNaN(value.getTime())) {
    return null
  }
  return WEEKDAY_LABELS[value.getDay()]
}

function deriveFloor(roomName) {
  const matches = String(roomName).match(/(\d{3,4})(?!.*\d)/)
  if (!matches) {
    return ''
  }
  const floor = Number(matches[1].slice(0, 1))
  return Number.isNaN(floor) ? '' : `${floor}F`
}

function buildDescription({ isAvailable, timeSlots, occupiedDetails, hasScheduleRecord }) {
  if (isAvailable) {
    return hasScheduleRecord
      ? `所选 ${timeSlots.length} 个节次均无排课，可直接使用。`
      : '该教室在本学期数据中未提及，默认视为长期空闲。'
  }

  if (occupiedDetails.length > 0) {
    return occupiedDetails.join('；')
  }

  return '所选节次内存在排课，不满足全时段空闲条件。'
}

// 基于一份课表快照构建查询服务。入参假定已通过上层校验：
// campus 为规范后的校区代码，timeSlots 均为 TIME_SLOT_SECTION_MAP 中合法的时间段。
function createClassroomService(dataset) {
  const rawClassrooms =
    dataset && typeof dataset === 'object' && Array.isArray(dataset.classrooms) ? dataset.classrooms : []
  const index = buildDatasetIndex(rawClassrooms)

  function buildInventory(campus, building) {
    const roomSet = index.roomSetByBuilding.get(`${campus}::${building}`)
    const rooms = roomSet ? Array.from(roomSet) : []
    return rooms.sort((left, right) => String(left).localeCompare(String(right), 'zh-CN', { numeric: true }))
  }

  function getBuildings(campus) {
    const buildingSet = index.buildingSetByCampus.get(campus)
    const buildings = buildingSet ? Array.from(buildingSet) : []
    return buildings.sort((left, right) => String(left).localeCompare(String(right), 'zh-CN', { numeric: true }))
  }

  function getFloors({ campus, building }) {
    const floors = buildInventory(campus, building).map((roomName) => deriveFloor(roomName))
    return [...new Set(floors.filter(Boolean))].sort((left, right) =>
      String(left).localeCompare(String(right), 'zh-CN', { numeric: true }),
    )
  }

  function getAvailability({ campus, building, date, floor, timeSlots }) {
    const weekdayLabel = getWeekdayLabel(date)

    const inventory = buildInventory(campus, building)
      .map((roomName) => {
        const roomDayKey = `${campus}::${building}::${roomName}::${weekdayLabel}`
        const scheduleRecord = index.scheduleByRoomAndDay.get(roomDayKey)
        const occupiedDetails = []

        const isAvailable = timeSlots.every((timeSlot) => {
          const sectionRecord = scheduleRecord?.get(TIME_SLOT_SECTION_MAP[timeSlot])
          if (sectionRecord?.occupied) {
            if (sectionRecord.details) {
              occupiedDetails.push(sectionRecord.details)
            }
            return false
          }
          return true
        })

        return {
          room: roomName,
          status: isAvailable ? 'available' : 'busy',
          floor: deriveFloor(roomName),
          description: buildDescription({
            isAvailable,
            timeSlots,
            occupiedDetails: [...new Set(occupiedDetails)],
            hasScheduleRecord: Boolean(scheduleRecord),
          }),
        }
      })
      .filter((room) => (floor ? room.floor === floor : true))

    const available = inventory.filter((room) => room.status === 'available').length

    return {
      success: true,
      message: inventory.length > 0 ? '查询成功' : '该教学楼暂无课表数据',
      lastUpdatedAt: index.latestUpdatedAt,
      query: {
        campus: CAMPUS_LABELS[campus] ?? campus,
        campusCode: campus,
        building,
        floor: floor || '全部楼层',
        date,
        timeSlots,
      },
      summary: {
        total: inventory.length,
        available,
        busy: inventory.length - available,
      },
      classrooms: inventory,
    }
  }

  return {
    getBuildings,
    getFloors,
    getAvailability,
    latestUpdatedAt: index.latestUpdatedAt,
  }
}

module.exports = {
  CAMPUS_LABELS,
  TIME_SLOT_SECTION_MAP,
  createClassroomService,
  deriveFloor,
  getWeekdayLabel,
  isKnownCampus,
  normalizeCampus,
  normalizeSection,
}
