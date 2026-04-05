
import xituchengBuildings from '../backend/data/xitucheng/buildings.json' assert { type: 'json' };
import shaheBuildings from '../backend/data/shahe/buildings.json' assert { type: 'json' };

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const params = url.searchParams;
    const campus = params.get('campus');


    if (url.pathname.includes('/api/buildings')) {
      const buildings = campus === 'shahe' ? shaheBuildings : xituchengBuildings;
      return new Response(JSON.stringify({ buildings }), {
        headers: { "Content-Type": "application/json" }
      });
    }


    return new Response(JSON.stringify({ message: "Handler initialized" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
};
