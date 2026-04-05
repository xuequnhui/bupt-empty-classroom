export default async function (request) {
  return new Response(JSON.stringify({ message: "Hello BUPT" }), {
    headers: { "content-type": "application/json" },
  });
}
