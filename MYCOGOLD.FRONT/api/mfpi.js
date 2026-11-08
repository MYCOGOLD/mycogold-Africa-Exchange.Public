export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return response.status(503).json({ error: 'MFPI unavailable' })
  const result = await fetch(`${url}/rest/v1/live_prices?select=*&order=tick.desc&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  if (!result.ok) { const detail = await result.text(); console.error('[v0] MFPI read failed', { status: result.status, detail }); return response.status(502).json({ error: 'MFPI unavailable' }) }
  const rows = await result.json()
  const row = rows?.[0] || null
  return response.status(200).json({ mfpi: row?.mfpi ?? null, tick: row?.tick ?? null, hubs: row?.hubs ?? null, proof: row?.proof ?? null, created_at: row?.created_at ?? null, validated_at: row?.validated_at ?? null, source: 'Supabase public.live_prices', mode: 'server-authoritative' })
}
