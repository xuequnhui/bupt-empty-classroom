const express = require('express')
const cors = require('cors')
const path = require('path')
const { buildQueryResult, campusBuildingMap, getFloorOptions } = require('./data/mockData')

const app = express()
const port = process.env.PORT || 4000

app.use(cors())
app.use(express.json())

// API Routes
app.get('/api/health', (_request, response) => {
  response.json({
    success: true,
    message: '服务运行正常',
  })
})

app.get('/api/buildings', (request, response) => {
  const campus = request.query.campus || 'xitucheng'
  const campusInfo = campusBuildingMap[campus]

  if (!campusInfo) {
    response.status(400).json({
      success: false,
      message: '未找到对应校区',
    })
    return
  }

  response.json({
    success: true,
    campus,
    label: campusInfo.label,
    buildings: campusInfo.buildings,
  })
})

app.get('/api/floors', (request, response) => {
  const campus = request.query.campus || 'xitucheng'
  const building = request.query.building

  if (!building) {
    response.status(400).json({
      success: false,
      message: '请提供教学楼参数',
    })
    return
  }

  if (!campusBuildingMap[campus]) {
    response.status(400).json({
      success: false,
      message: '校区参数不正确',
    })
    return
  }

  response.json({
    success: true,
    campus,
    building,
    floors: getFloorOptions({ campus, building }),
  })
})

app.get('/api/availability', (request, response) => {
  const campus = request.query.campus || 'xitucheng'
  const date = request.query.date
  const building = request.query.building
  const floor = request.query.floor || ''
  const timeSlots = Array.isArray(request.query.timeSlot)
    ? request.query.timeSlot.filter(Boolean)
    : request.query.timeSlot
      ? [request.query.timeSlot]
      : []

  if (!date || !building || timeSlots.length === 0) {
    response.status(400).json({
      success: false,
      message: '请完整提供校区、日期、教学楼和至少一个时间段',
    })
    return
  }

  if (!campusBuildingMap[campus]) {
    response.status(400).json({
      success: false,
      message: '校区参数不正确',
    })
    return
  }

  response.json(buildQueryResult({ campus, building, date, floor, timeSlots }))
})

// Serve static files in production
const distPath = path.join(__dirname, '../frontend/dist')
app.use(express.static(distPath))

// Handle SPA routing - send all other requests to index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(distPath, 'index.html'))
  }
})

if (require.main === module) {
  app.listen(port, '0.0.0.0', () => {
    console.log(`BUPT 空教室后端服务已启动: http://0.0.0.0:${port}`)
  })
}

module.exports = app
