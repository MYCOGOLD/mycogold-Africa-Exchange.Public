export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return response.status(503).json({ error: 'Prices unavailable' })
  const result = await fetch(`${url}/rest/v1/listings?select=*&status=eq.active&order=created_at.desc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  if (!result.ok) { const detail = await result.text(); console.error('[v0] verified prices read failed', { status: result.status, detail }); return response.status(502).json({ error: 'Prices unavailable' }) }
  const listings = await result.json()
  const grouped = new Map()
  for (const row of listings) { const product = row?.product || row?.category || 'Produce'; const current = grouped.get(product) || { product, prices: [], listingCount: 0, locations: new Set() }; if (Number.isFinite(Number(row?.price))) current.prices.push(Number(row.price)); current.listingCount += 1; if (row?.location) current.locations.add(row.location); grouped.set(product, current) }
  const prices = [...grouped.values()].map(group => ({ product: group.product, live: group.prices.length ? Math.round(group.prices.reduce((sum, value) => sum + value, 0) / group.prices.length * 100) / 100 : null, listingCount: group.listingCount, tradeCount: 0, locations: [...group.locations] }))
  return response.status(200).json({ source: 'Supabase public.listings', listings, prices, references: [], locations: [] })
}
