export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return response.status(503).json({ error: 'Listings unavailable' })

  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '') || key
  if (request.method === 'POST') {
    const payload = typeof request.body === 'string' ? JSON.parse(request.body) : request.body
    if (!payload?.seller_id || !payload?.category || !payload?.product || !payload?.location || !payload?.market || !Number.isFinite(Number(payload?.price))) return response.status(400).json({ error: 'Missing required listing fields' })
    const insert = await fetch(`${url}/rest/v1/listings`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ seller_id: payload.seller_id, category: payload.category, product: payload.product, location: payload.location, price: Number(payload.price), seller: payload.seller || 'Verified seller', quantity: Number(payload.quantity || 0) }) })
    const body = await insert.text()
    if (!insert.ok) { console.error('[listings] Supabase insert failed', { table: 'public.listings', status: insert.status, detail: body }); return response.status(502).json({ error: 'Listing could not be saved' }) }
    return response.status(201).json({ source: 'Supabase', table: 'public.listings', listing: JSON.parse(body)[0] })
  }
  const endpoint = `${url}/rest/v1/listings?select=id,category,product,location,price,seller,quantity,seller_id&order=created_at.desc&limit=100`
  const result = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${token}` } })

  if (!result.ok) {
    const detail = await result.text()
    console.error('[listings] Supabase query failed', { table: 'public.listings', status: result.status, detail })
    return response.status(502).json({ error: 'Listings unavailable' })
  }
  const rows = await result.json()
  return response.status(200).json({ source: 'Supabase', table: 'public.listings', listings: rows })
}
