export async function POST(request: Request) {
  const { comments } = await request.json();
  return Response.json({ status: "DISPUTED", adminOversight: true, escrowLocked: true, reason: comments });
}