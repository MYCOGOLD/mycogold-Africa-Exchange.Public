import { createHash } from 'node:crypto'

const send = (res, body, status = 200) => res.status(status).setHeader('content-type', 'application/json').send(JSON.stringify(body))
const serverTick = () => Math.floor(Date.now() / 1000)
const simulatedValue = tick => { const digest = createHash('sha256').update(`MYCOGOLD-MFPI-${tick}-2026`).digest(); const unit = digest.readUInt32BE(0) / 0xffffffff; return Math.round((100 + (unit - 0.5) * 0.8) * 10000) / 10000 }
const BASE_BASKET = { Beef: 675, Mushroom: 525, Potatoes: 100, Onions: 125, Kales: 40, Cabbage: 80, Cereals: 75, Milk: 60 }
const family = category => { const value = String(category || ''); if (/oyster|button|mushroom/i.test(value)) return 'Mushroom'; if (/maize|beans|cereal|ndengu/i.test(value)) return 'Cereals'; if (/sukuma|kale/i.test(value)) return 'Kales'; return Object.keys(BASE_BASKET).find(key => value.toLowerCase().includes(key.toLowerCase())) }
async function realBasket(base, key) {
  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  const [listingResponse, tradeResponse] = await Promise.all([fetch(`${base}/rest/v1/listings?select=category,product,price,created_at`, { headers }), fetch(`${base}/rest/v1/trades?select=category,product,trade_price,created_at`, { headers })])
  const listings = listingResponse.ok ? await listingResponse.json() : []
  const trades = tradeResponse.ok ? await tradeResponse.json() : []
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const prices = {}
  for (const row of listings) { if (row.created_at && new Date(row.created_at).getTime() < cutoff) continue; const keyName = family(row.category || row.product); const value = Number(row.price); if (keyName && Number.isFinite(value)) (prices[keyName] ||= { listings: [], trades: [] }).listings.push(value) }
  for (const row of trades) { if (row.created_at && new Date(row.created_at).getTime() < cutoff) continue; const keyName = family(row.category || row.product); const value = Number(row.trade_price); if (keyName && Number.isFinite(value)) (prices[keyName] ||= { listings: [], trades: [] }).trades.push(value) }
  const basket = Object.entries(prices).map(([name, values]) => { const list = values.listings; const trade = values.trades; const listingAverage = list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : null; const tradeAverage = trade.length ? trade.reduce((sum, value) => sum + value, 0) / trade.length : null; const current = tradeAverage !== null ? (listingAverage === null ? tradeAverage : tradeAverage * 0.7 + listingAverage * 0.3) : listingAverage; return current === null ? null : { name, current, base: BASE_BASKET[name], listings: list.length, trades: trade.length } }).filter(Boolean)
  if (!basket.length) return { value: null, basket: [], mode: 'simulated-awaiting-real-trades' }
  const currentTotal = basket.reduce((sum, item) => sum + item.current, 0); const baseTotal = basket.reduce((sum, item) => sum + item.base, 0)
  return { value: Math.round((100 * currentTotal / baseTotal) * 10000) / 10000, basket, mode: 'real-weighted-basket' }
}

export default async function handler(req, res) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!base || !key) return send(res, { error: 'Supabase configuration unavailable' }, 503)
  if (req.method !== 'GET') return send(res, { error: 'Method not allowed' }, 405)
  const tick = serverTick(); let basket = { value: null, basket: [], mode: 'simulated-awaiting-real-trades' }
  try { basket = await realBasket(base, key) } catch (error) { console.error('[v0] MFPI basket read failed', error) }
  const mfpi = basket.value ?? simulatedValue(tick); const updatedAt = new Date().toISOString(); const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }
  try { const response = await fetch(`${base}/rest/v1/live_prices?on_conflict=id`, { method: 'POST', headers, body: JSON.stringify({ id: 1, mfpi, tick, updated_at: updatedAt }) }); if (!response.ok) console.error('[v0] MFPI server upsert failed', response.status) } catch (error) { console.error('[v0] MFPI server upsert error', error) }
  return send(res, { id: 1, mfpi, tick, updated_at: updatedAt, mode: basket.mode, basket: basket.basket })
}
