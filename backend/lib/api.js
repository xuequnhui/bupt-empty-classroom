// 统一的 API 请求处理：路由、参数校验与业务逻辑只在这里实现一份，
// 本地 Express（backend/server.js）与 Vercel Serverless（api/[...route].js）都委托给它。

const dataset = require('../data/data.json')
const {
  CAMPUS_LABELS,
  TIME_SLOT_SECTION_MAP,
  createClassroomService,
  getWeekdayLabel,
  isKnownCampus,
  normalizeCampus,
} = require('./classroomService')

const service = createClassroomService(dataset)

function jsonError(status, message) {
  return { status, payload: { success: false, message } }
}

function handleApiRequest(method, pathname, searchParams) {
  if (method === 'OPTIONS') {
    return { status: 204, payload: null }
  }

  if (method !== 'GET') {
    return jsonError(405, '仅支持 GET 请求')
  }

  if (pathname.endsWith('/health') || pathname.endsWith('/api/health')) {
    return { status: 200, payload: { success: true, message: '服务运行正常' } }
  }

  const campus = searchParams.get('campus') || 'xitucheng'
  const campusCode = normalizeCampus(campus)

  if (pathname.includes('/buildings')) {
    if (!isKnownCampus(campus)) {
      return jsonError(400, '未找到对应校区')
    }

    return {
      status: 200,
      payload: {
        success: true,
        campus: campusCode,
        label: CAMPUS_LABELS[campusCode],
        buildings: service.getBuildings(campusCode),
      },
    }
  }

  if (pathname.includes('/floors')) {
    const building = searchParams.get('building')

    if (!building) {
      return jsonError(400, '请提供教学楼参数')
    }

    if (!isKnownCampus(campus)) {
      return jsonError(400, '校区参数不正确')
    }

    return {
      status: 200,
      payload: {
        success: true,
        campus: campusCode,
        building,
        floors: service.getFloors({ campus: campusCode, building }),
      },
    }
  }

  if (pathname.includes('/availability')) {
    const date = searchParams.get('date')
    const building = searchParams.get('building')
    const floor = searchParams.get('floor') || ''
    const timeSlots = searchParams.getAll('timeSlot').filter(Boolean)

    if (!date || !building || timeSlots.length === 0) {
      return jsonError(400, '请完整提供校区、日期、教学楼和至少一个时间段')
    }

    if (!isKnownCampus(campus)) {
      return jsonError(400, '校区参数不正确')
    }

    // 非法时间段若被静默当作“无课”，查询结果会系统性偏乐观，必须拒绝
    if (!timeSlots.every((timeSlot) => Boolean(TIME_SLOT_SECTION_MAP[timeSlot]))) {
      return jsonError(400, '时间段参数不正确')
    }

    if (!getWeekdayLabel(date)) {
      return jsonError(400, '日期格式不正确')
    }

    return {
      status: 200,
      payload: service.getAvailability({ campus: campusCode, building, date, floor, timeSlots }),
    }
  }

  return { status: 200, payload: { success: true, message: 'API is alive', path: pathname } }
}

module.exports = { handleApiRequest }
