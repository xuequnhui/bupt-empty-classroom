const campusBuildingMap = {
  xitucheng: {
    label: '西土城校区',
    buildings: ['教一楼', '教二楼', '教三楼', '新科研楼', '未来学习大楼'],
  },
  shahe: {
    label: '沙河校区',
    buildings: ['教学实验综合楼', 'S1 教学楼', 'S2 教学楼', '学院楼'],
  },
}

const classroomTemplate = {
  '教一楼': [
    { room: '教一楼 101', floor: '1F', capacity: 80, status: 'available', description: '多媒体教室，适合小组讨论与自习。' },
    { room: '教一楼 204', floor: '2F', capacity: 120, status: 'busy', description: '当前时段有课程安排。' },
    { room: '教一楼 305', floor: '3F', capacity: 60, status: 'available', description: '靠窗安静区域，适合短时复习。' },
  ],
  '教二楼': [
    { room: '教二楼 102', floor: '1F', capacity: 90, status: 'busy', description: '设备齐全，当前已被占用。' },
    { room: '教二楼 208', floor: '2F', capacity: 70, status: 'available', description: '教室光线较好，适合个人学习。' },
    { room: '教二楼 405', floor: '4F', capacity: 110, status: 'available', description: '大教室，适合多人集体自习。' },
  ],
  '教三楼': [
    { room: '教三楼 201', floor: '2F', capacity: 75, status: 'available', description: '临近楼梯口，进出方便。' },
    { room: '教三楼 307', floor: '3F', capacity: 100, status: 'busy', description: '当前有实验课占用。' },
    { room: '教三楼 402', floor: '4F', capacity: 90, status: 'available', description: '网络条件较稳定。' },
  ],
  '新科研楼': [
    { room: '新科研楼 A201', floor: '2F', capacity: 48, status: 'available', description: '空间安静，适合个人学习与查阅资料。' },
    { room: '新科研楼 B312', floor: '3F', capacity: 36, status: 'busy', description: '当前有科研讨论或预约使用。' },
    { room: '新科研楼 C405', floor: '4F', capacity: 60, status: 'available', description: '座位充足，适合中等规模自习。' },
  ],
  '未来学习大楼': [
    { room: '未来学习大楼 101', floor: '1F', capacity: 120, status: 'available', description: '开放式智慧教室，适合多种学习场景。' },
    { room: '未来学习大楼 305', floor: '3F', capacity: 80, status: 'busy', description: '当前有课程或研讨活动安排。' },
    { room: '未来学习大楼 508', floor: '5F', capacity: 64, status: 'available', description: '数智化学习空间，适合长时间自习。' },
  ],
  '教学实验综合楼': [
    { room: '综教楼 101', floor: '1F', capacity: 120, status: 'busy', description: '基础课上课中。' },
    { room: '综教楼 303', floor: '3F', capacity: 80, status: 'available', description: '多媒体配置完善。' },
    { room: '综教楼 509', floor: '5F', capacity: 60, status: 'available', description: '适合中型人数复习。' },
  ],
  'S1 教学楼': [
    { room: 'S1-201', floor: '2F', capacity: 90, status: 'available', description: '距离食堂较近，适合短时学习。' },
    { room: 'S1-304', floor: '3F', capacity: 120, status: 'busy', description: '当前有课程进行。' },
    { room: 'S1-502', floor: '5F', capacity: 60, status: 'available', description: '相对安静，适合刷题。' },
  ],
  'S2 教学楼': [
    { room: 'S2-105', floor: '1F', capacity: 100, status: 'busy', description: '上午时段占用率较高。' },
    { room: 'S2-207', floor: '2F', capacity: 80, status: 'available', description: '空闲率较高。' },
    { room: 'S2-408', floor: '4F', capacity: 100, status: 'available', description: '适合结伴自习。' },
  ],
  '学院楼': [
    { room: '学院楼 202', floor: '2F', capacity: 45, status: 'available', description: '小教室，适合个人学习。' },
    { room: '学院楼 315', floor: '3F', capacity: 55, status: 'busy', description: '当前用于专题讨论。' },
    { room: '学院楼 406', floor: '4F', capacity: 65, status: 'available', description: '安静整洁，适合晚间自习。' },
  ],
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
    const campusInfo = campusBuildingMap[campus]

    if (!campusInfo) {
      return jsonResponse({ success: false, message: '未找到对应校区' }, { status: 400 })
    }

    return jsonResponse({
      success: true,
      campus,
      label: campusInfo.label,
      buildings: campusInfo.buildings,
    })
  }

  if (pathname.includes('/floors')) {
    const campus = url.searchParams.get('campus') || 'xitucheng'
    const building = url.searchParams.get('building')

    if (!building) {
      return jsonResponse({ success: false, message: '请提供教学楼参数' }, { status: 400 })
    }

    if (!campusBuildingMap[campus]) {
      return jsonResponse({ success: false, message: '校区参数不正确' }, { status: 400 })
    }

    const floors = [...new Set((classroomTemplate[building] ?? []).map((room) => room.floor).filter(Boolean))]
    return jsonResponse({ success: true, campus, building, floors })
  }

  if (pathname.includes('/availability')) {
    const campus = url.searchParams.get('campus') || 'xitucheng'
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

    if (!campusBuildingMap[campus]) {
      return jsonResponse({ success: false, message: '校区参数不正确' }, { status: 400 })
    }

    const inventory = (classroomTemplate[building] ?? []).filter((room) => !floor || room.floor === floor)
    const available = inventory.filter((room) => room.status === 'available').length
    const busy = inventory.length - available

    return jsonResponse({
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
        total: inventory.length,
        available,
        busy,
      },
      classrooms: inventory.map((room) => ({
        room: room.room,
        status: room.status,
        capacity: room.capacity,
        floor: room.floor,
        description: room.description,
      })),
    })
  }

  return jsonResponse({ success: true, message: 'API is alive', path: pathname })
}

module.exports = {
  fetch: handleFetch,
}
