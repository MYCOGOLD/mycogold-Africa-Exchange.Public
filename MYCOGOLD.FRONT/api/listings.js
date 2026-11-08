export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST')
    return response.status(405).json({ error: 'Method not allowed' })
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return response.status(503).json({ error: 'Listings unavailable' })
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '') || key
  const headers = { apikey: key, Authorization: `Bearer ${token}` }
  if (request.method === 'POST') {
    const payload = typeof request.body === 'string' ? JSON.parse(request.body) : request.body
    if (!payload?.seller_id || !payload?.category || !payload?.product || !payload?.location || !Number.isFinite(Number(payload?.price))) return response.status(400).json({ error: 'Missing required listing fields' })
    const insert = await fetch(`${url}/rest/v1/listings`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ seller_id: payload.seller_id, category: payload.category, product: payload.product, location: payload.location, price: Number(payload.price), quantity: Number(payload.quantity || 0), seller: payload.seller || 'Verified seller', status: 'active' }) })
    const body = await insert.text()
    if (!insert.ok) { console.error('[v0] listings insert failed', { status: insert.status, detail: body }); return response.status(502).json({ error: 'Listing could not be saved' }) }
    return response.status(201).json({ source: 'Supabase', table: 'public.listings', listing: JSON.parse(body)[0] })
  }
  const result = await fetch(`${url}/rest/v1/listings?select=*&status=eq.active&order=created_at.desc`, { headers })
  if (!result.ok) { const detail = await result.text(); console.error('[v0] listings query failed', { status: result.status, detail }); return response.status(502).json({ error: 'Listings unavailable' }) }
  return response.status(200).json({ source: 'Supabase', table: 'public.listings', listings: await result.json() })
}
