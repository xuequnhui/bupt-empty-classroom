const { buildQueryResult, campusBuildingMap, getFloorOptions } = require('../backend/data/mockData')

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

    return jsonResponse({
      success: true,
      campus,
      building,
      floors: getFloorOptions({ campus, building }),
    })
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

    return jsonResponse(buildQueryResult({ campus, building, date, floor, timeSlots }))
  }

  return jsonResponse({ success: true, message: 'API is alive', path: pathname })
}

async function nodeHandler(req, res) {
  const origin = `http://${req.headers.host}`
  const requestUrl = new URL(req.url, origin).toString()
  const request = new Request(requestUrl, { method: req.method, headers: req.headers })
  const response = await handleFetch(request)

  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  res.end(Buffer.from(await response.arrayBuffer()))
}

nodeHandler.fetch = handleFetch
module.exports = nodeHandler
