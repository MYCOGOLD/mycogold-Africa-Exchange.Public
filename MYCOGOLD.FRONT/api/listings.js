export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return response.status(503).json({ error: 'Listings unavailable' })

  const endpoint = `${url}/rest/v1/listings?select=category,product,location,market,price,seller,buyer,quantity,blocked&order=created_at.desc&limit=100`
  const result = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })

  if (!result.ok) {
    const detail = await result.text()
    console.error('[listings] Supabase query failed', { table: 'public.listings', status: result.status, detail })
    return response.status(502).json({ error: 'Listings unavailable' })
  }
  const rows = await result.json()
  return response.status(200).json({ source: 'Supabase', table: 'public.listings', listings: rows })
}
