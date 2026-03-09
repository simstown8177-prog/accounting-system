export async function GET() {
  return Response.json({
    status: "ok",
    service: "accounting-system-web",
    timestamp: new Date().toISOString(),
  });
}
