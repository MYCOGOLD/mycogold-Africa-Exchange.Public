import { NextResponse } from 'next/server';
export async function GET(req: Request) {
  const url = new URL(req.url);
  const hub = url.searchParams.get('hub');
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  if (!hub || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: 'Invalid hub or coordinates' }, { status: 400 });
  }
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation&timezone=auto`, { next: { revalidate: 3600 } });
    if (!res.ok) return NextResponse.json({ error: 'Weather upstream failed' }, { status: 502 });
    const j = await res.json();
    return NextResponse.json({ hub, lat, lng, current: j.current });
  } catch {
    return NextResponse.json({ error: 'Weather upstream failed' }, { status: 502 });
  }
}
