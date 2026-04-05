
const xituchengBuildings = ["教一楼", "教二楼", "教三楼", "教四楼", "西配楼"]; 
const shaheBuildings = ["教零", "教一", "教二", "教三", "实验楼"]; 

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const params = url.searchParams;
    const campus = params.get('campus');


    if (url.pathname.includes('/api/buildings')) {
      const buildings = campus === 'shahe' ? shaheBuildings : xituchengBuildings;
      return new Response(JSON.stringify({ buildings }), {
        headers: { 
          "Content-Type": "application/json;charset=UTF-8",
          "Access-Control-Allow-Origin": "*" 
        }
      });
    }


    return new Response(JSON.stringify({ message: "API is working" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
};
