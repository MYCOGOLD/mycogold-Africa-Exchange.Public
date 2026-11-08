const send = (res, body, status = 200) => res.status(status).setHeader('content-type', 'application/json').send(JSON.stringify(body))
export default async function handler(req, res) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!base || !key) return send(res, { matches: [] })
  try {
    if (req.method === 'POST') {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
      if (!token) return send(res, { error: 'Sign in to request a match' }, 401)
      const response = await fetch(`${base}/rest/v1/matches`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ listing_id: payload?.listingId, seller_id: payload?.sellerId || null, buyer_id: payload?.buyerId || null, match_score: Number(payload?.score || 0), status: 'pending' }) })
      if (!response.ok) return send(res, { error: 'Match schema unavailable or request rejected' }, response.status)
      return send(res, { match: (await response.json())[0] || null, room: `${payload?.sellerAlias || 'Seller #K-042'} <> ${payload?.buyerAlias || 'Buyer #N-018'}` }, 201)
    }
    const response = await fetch(`${base}/rest/v1/listings?select=id,product,category,location,price,quantity,seller_id&limit=3`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
    if (!response.ok) return send(res, { matches: [] })
    const listings = await response.json()
    return send(res, { matches: listings.map((listing, index) => ({ id: listing.id, listingId: listing.id, sellerId: listing.seller_id, seller: `Seller #K-${String(index + 42).padStart(3, '0')}`, product: listing.product, location: listing.location, price: listing.price, score: 90 - index * 3, status: 'pending' })) })
  } catch (error) { console.error('[v0] matching failed', error); return send(res, { matches: [] }) }
}
