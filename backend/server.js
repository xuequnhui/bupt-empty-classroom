const express = require('express')
const cors = require('cors')
const path = require('path')
const { handleApiRequest } = require('./lib/api')

const app = express()
const port = process.env.PORT || 4000

app.use(cors())

// API 与生产环境（api/[...route].js）共用同一处理逻辑
app.all('/api/*', (request, response) => {
  const url = new URL(request.originalUrl, `http://localhost:${port}`)
  const { status, payload } = handleApiRequest(request.method, url.pathname, url.searchParams)

  if (status === 204 || payload === null || payload === undefined) {
    response.status(status).end()
    return
  }

  response.status(status).json(payload)
})

// 静态资源
const distPath = path.join(__dirname, '../frontend/dist')
app.use(express.static(distPath))

// SPA 路由回退
app.get('*', (request, response) => {
  response.sendFile(path.join(distPath, 'index.html'), (error) => {
    if (error) {
      response.status(404).json({ success: false, message: '前端构建产物缺失，请先执行 npm run build' })
    }
  })
})

if (require.main === module) {
  app.listen(port, '0.0.0.0', () => {
    console.log(`BUPT 空教室后端服务已启动: http://0.0.0.0:${port}`)
  })
}

module.exports = app
