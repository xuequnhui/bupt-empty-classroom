// Vercel Serverless 入口：路由、校验与业务逻辑统一在 backend/lib/api 中实现。
// 保持零 npm 依赖，data.json 通过显式 require 打进函数包。

const { handleApiRequest } = require('../backend/lib/api')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
}

function toResponse({ status, payload }) {
  // 204/空负载不允许携带响应体
  if (status === 204 || payload === null || payload === undefined) {
    return new Response(null, { status, headers: CORS_HEADERS })
  }

  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=UTF-8' },
  })
}

function handleFetch(request) {
  const url = new URL(request.url)
  return toResponse(handleApiRequest(request.method, url.pathname, url.searchParams))
}

module.exports = {
  fetch: handleFetch,
}
