export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 构造一个简单的 JSON 响应
    const data = {
      message: "Hello BUPT",
      path: url.pathname,
      time: new Date().toISOString()
    };

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "Access-Control-Allow-Origin": "*" // 允许跨域，方便前端调试
      }
    });
  }
};
