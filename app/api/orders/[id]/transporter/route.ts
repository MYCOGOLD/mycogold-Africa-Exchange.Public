export async function POST(request: Request) {
  const { stage, photos, video, lat, lng } = await request.json();
  if (!Array.isArray(photos) || !photos.length || !video) return Response.json({ error: "TRANSPORTER_MEDIA_REQUIRED" }, { status: 400 });
  if (lat == null || lng == null) return Response.json({ error: "LOCATION_REQUIRED" }, { status: 400 });
  return Response.json({ stage, location: { lat, lng }, liveIoT: true, recorded: true });
}