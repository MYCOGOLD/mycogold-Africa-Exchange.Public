const json = (body, status = 200) => ({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

export default async function handler(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return json({ error: 'Supabase configuration unavailable' }, 503)

  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  if (req.method === 'GET') {
    const response = await fetch(`${url}/rest/v1/live_prices?id=eq.1&select=id,price,updated_at&limit=1`, { headers })
    const body = await response.text()
    if (!response.ok) {
      console.error('[v0] MFPI read failed', response.status, body)
      return json({ error: 'MFPI read failed' }, 502)
    }
    const rows = JSON.parse(body)
    return json(rows[0] || null)
  }

  if (req.method === 'POST') {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const response = await fetch(`${url}/rest/v1/live_prices?on_conflict=id`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: 1, price: Number(payload.price), updated_at: payload.updated_at || new Date().toISOString() }),
    })
    if (!response.ok) {
      const body = await response.text()
      console.error('[v0] MFPI write failed', response.status, body)
      return json({ error: 'MFPI write failed' }, 502)
    }
    return json({ ok: true })
  }

  return json({ error: 'Method not allowed' }, 405)
}
