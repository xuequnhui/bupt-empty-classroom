export default async function (request) {
  try {
    return new Response(JSON.stringify({ message: "Hello BUPT" }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json;charset=UTF-8" 
      },
    });
  } catch (e) {
    return new Response(e.stack, { status: 500 });
  }
}
