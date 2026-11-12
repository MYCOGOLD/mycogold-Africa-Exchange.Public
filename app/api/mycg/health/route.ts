export async function GET() {
  return Response.json({
    status: 'ok',
    service: 'mycogold',
    mfpi: '99.06654',
    mycg: { dormant: true, max: 67000000, issued: 0 },
    time: new Date().toISOString(),
  })
}