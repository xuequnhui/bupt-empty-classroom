// 基于真实数据快照的 API 行为测试（node 内置 test runner，无额外依赖）。
const { test } = require('node:test')
const assert = require('node:assert/strict')

const { handleApiRequest } = require('../backend/lib/api')
const { normalizeCampus, deriveFloor, getWeekdayLabel } = require('../backend/lib/classroomService')
const dataset = require('../backend/data/data.json')

function request(method, pathname, params = {}) {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      searchParams.append(key, String(item))
    }
  }
  return handleApiRequest(method, pathname, searchParams)
}

function distinctRooms(campus, building) {
  const campusCode = normalizeCampus(campus)
  const rooms = new Set(
    dataset.classrooms
      .filter((entry) => normalizeCampus(entry.campus) === campusCode && entry.building === building)
      .map((entry) => entry.roomName),
  )
  return rooms
}

test('health 返回 200', () => {
  const { status, payload } = request('GET', '/api/health')
  assert.equal(status, 200)
  assert.equal(payload.success, true)
})

test('OPTIONS 返回 204 且不带响应体', () => {
  const { status, payload } = request('OPTIONS', '/api/health')
  assert.equal(status, 204)
  assert.equal(payload, null)
})

test('非 GET 请求返回 405', () => {
  const { status } = request('POST', '/api/buildings')
  assert.equal(status, 405)
})

test('buildings 只返回数据中实际存在的教学楼', () => {
  const { status, payload } = request('GET', '/api/buildings', { campus: 'xitucheng' })
  assert.equal(status, 200)
  // 数据中不存在的楼不应出现（假数据兜底已移除）
  const expected = [...new Set(dataset.classrooms.filter((c) => normalizeCampus(c.campus) === 'xitucheng').map((c) => c.building))].sort()
  assert.deepEqual(payload.buildings.sort(), expected)
})

test('buildings 未知校区返回 400', () => {
  const { status } = request('GET', '/api/buildings', { campus: 'foo' })
  assert.equal(status, 400)
})

test('buildings 支持中文校区别名', () => {
  const { status, payload } = request('GET', '/api/buildings', { campus: '沙河校区' })
  assert.equal(status, 200)
  assert.equal(payload.campus, 'shahe')
})

test('floors 缺少教学楼参数返回 400', () => {
  const { status } = request('GET', '/api/floors', { campus: 'xitucheng' })
  assert.equal(status, 400)
})

test('floors 返回派生楼层列表', () => {
  const { status, payload } = request('GET', '/api/floors', { campus: 'xitucheng', building: '教三楼' })
  assert.equal(status, 200)
  assert.ok(Array.isArray(payload.floors))
  assert.ok(payload.floors.every((floor) => /^\dF$/.test(floor)))
})

test('availability 缺少必填参数返回 400', () => {
  const { status } = request('GET', '/api/availability', { campus: 'xitucheng', building: '教三楼' })
  assert.equal(status, 400)
})

test('availability 非法时间段返回 400（不得静默视为空闲）', () => {
  const { status } = request('GET', '/api/availability', {
    campus: 'xitucheng',
    building: '教三楼',
    date: '2026-11-11',
    timeSlot: '99:99-99:99',
  })
  assert.equal(status, 400)
})

test('availability 非法日期返回 400', () => {
  const { status } = request('GET', '/api/availability', {
    campus: 'xitucheng',
    building: '教三楼',
    date: 'not-a-date',
    timeSlot: '08:00-08:45',
  })
  assert.equal(status, 400)
})

test('availability 查询结果与数据快照一致且字段完整', () => {
  const building = '教三楼'
  const { status, payload } = request('GET', '/api/availability', {
    campus: 'xitucheng',
    building,
    date: '2026-11-11',
    timeSlot: ['08:00-08:45', '08:50-09:35'],
  })

  assert.equal(status, 200)
  assert.equal(payload.summary.total, distinctRooms('xitucheng', building).size)
  assert.equal(payload.summary.available + payload.summary.busy, payload.summary.total)
  assert.ok(payload.summary.total > 0)
  assert.ok(payload.lastUpdatedAt, '应携带数据快照时间')
  assert.equal(payload.query.building, building)

  for (const room of payload.classrooms) {
    assert.ok(room.room)
    assert.ok(['available', 'busy'].includes(room.status))
    assert.ok(typeof room.description === 'string')
    // 编造的容量字段已移除
    assert.equal(room.capacity, undefined)
  }
})

test('availability 按楼层过滤后全部匹配', () => {
  const building = '教三楼'
  const { payload: floorsPayload } = request('GET', '/api/floors', { campus: 'xitucheng', building })
  const floor = floorsPayload.floors[0]
  const { payload } = request('GET', '/api/availability', {
    campus: 'xitucheng',
    building,
    date: '2026-11-11',
    floor,
    timeSlot: '08:00-08:45',
  })

  assert.ok(payload.summary.total > 0)
  assert.ok(payload.classrooms.every((room) => room.floor === floor))
})

test('availability 数据中不存在的教学楼返回空结果而非编造教室', () => {
  const { status, payload } = request('GET', '/api/availability', {
    campus: 'xitucheng',
    building: '新科研楼',
    date: '2026-11-11',
    timeSlot: '08:00-08:45',
  })

  assert.equal(status, 200)
  assert.equal(payload.summary.total, 0)
  assert.deepEqual(payload.classrooms, [])
  assert.match(payload.message, /暂无/)
})

test('weekend 与工作日的星期标签映射正确', () => {
  assert.equal(getWeekdayLabel('2026-11-11'), '星期三')
  assert.equal(getWeekdayLabel('2026-11-15'), '星期日')
  assert.equal(getWeekdayLabel('bad'), null)
})

test('deriveFloor 覆盖常见命名与无法识别的情况', () => {
  assert.equal(deriveFloor('1-101'), '1F')
  assert.equal(deriveFloor('教学实验综合楼-N411'), '4F')
  assert.equal(deriveFloor('虚拟实验室（调课用）'), '')
})
