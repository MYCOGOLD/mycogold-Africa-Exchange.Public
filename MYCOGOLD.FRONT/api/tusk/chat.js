const send = (res, body, status = 200) => res.status(status).setHeader('content-type', 'application/json').send(JSON.stringify(body))
const dbRows = async (base, key, table, select) => { const r = await fetch(`${base}/rest/v1/${table}?select=${select}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }); if (!r.ok) { console.error(`[v0] optional ${table} read skipped`, r.status); return [] } return r.json() }
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, { error: 'Method not allowed' }, 405)
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!base || !key) return send(res, { answer: 'No real data yet - Supabase is not configured.', sources: [] })
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const question = String(body?.question || '').trim()
    const [listings, trades] = await Promise.all([dbRows(base, key, 'listings', 'product,category,location,price,created_at'), dbRows(base, key, 'trades', 'product,category,location,trade_price,created_at')])
    const sourceCount = listings.length + trades.length
    if (!sourceCount) return send(res, { answer: 'No real data yet - Be first to post a listing or complete a trade.', sources: [{ table: 'public.listings', rows: 0 }, { table: 'public.trades', rows: 0 }] })
    const prices = [...listings.map(row => Number(row.price)), ...trades.map(row => Number(row.trade_price))].filter(Number.isFinite)
    const average = prices.length ? Math.round(prices.reduce((sum, value) => sum + value, 0) / prices.length) : null
    const answer = question.toLowerCase().includes('weather') || question.toLowerCase().includes('rain') ? 'Weather insight requires a location. Ask about Kericho, Nakuru, Nairobi, Kisumu, Eldoret, or Nyandarua.' : average === null ? 'Real records exist, but none contain a valid price yet.' : `The current real-data average is ${average} KES from ${trades.length} trades and ${listings.length} listings. Ask for a specific product or location for a narrower result.`
    return send(res, { answer, sources: [{ table: 'public.listings', rows: listings.length }, { table: 'public.trades', rows: trades.length }] })
  } catch (error) { console.error('[v0] TUSK chat failed', error); return send(res, { answer: 'No real data yet - TUSK could not read the exchange tables.', sources: [] }, 200) }
}
