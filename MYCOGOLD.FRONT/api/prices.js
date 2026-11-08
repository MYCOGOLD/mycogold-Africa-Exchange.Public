const send = (res, body, status = 200) => res.status(status).setHeader('content-type', 'application/json').send(JSON.stringify(body))
const numeric = value => Number.isFinite(Number(value)) ? Number(value) : null
const median = values => { const sorted = values.filter(value => value !== null).sort((a, b) => a - b); if (!sorted.length) return null; const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2 }
const rows = async (base, key, table, select, token = key) => { const response = await fetch(`${base}/rest/v1/${table}?select=${select}`, { headers: { apikey: key, Authorization: `Bearer ${token}` } }); if (response.status === 404 || response.status === 406) return []; if (!response.ok) throw new Error(`${table} query failed: ${response.status}`); return response.json() }

export default async function handler(req, res) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!base || !key) return send(res, { error: 'Supabase configuration unavailable' }, 503)
  try {
    const [listingRows, tradeRows, referenceRows] = await Promise.all([
      rows(base, key, 'listings', 'category,product,location,price,created_at'),
      rows(base, key, 'trades', 'category,product,location,trade_price,price,created_at'),
      rows(base, key, 'reference_prices', 'product,category,unit,wholesale_price,retail_price,wholesale_unit,source,reference_date'),
    ])
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    const recent = row => !row.created_at || new Date(row.created_at).getTime() >= cutoff
    const keys = new Set([...listingRows, ...tradeRows].filter(recent).map(row => row.product || row.category).filter(Boolean))
    const prices = [...keys].map(product => {
      const listings = listingRows.filter(row => recent(row) && (row.product === product || row.category === product)).map(row => numeric(row.price)).filter(value => value !== null)
      const trades = tradeRows.filter(row => recent(row) && (row.product === product || row.category === product)).map(row => numeric(row.trade_price ?? row.price)).filter(value => value !== null)
      const listingMedian = median(listings)
      const tradeMedian = median(trades)
      const live = tradeMedian !== null ? (listingMedian !== null ? 0.7 * tradeMedian + 0.3 * listingMedian : tradeMedian) : listingMedian
      return { product, live: live === null ? null : Math.round(live * 100) / 100, tradeCount: trades.length, listingCount: listings.length, updatedAt: new Date().toISOString() }
    })
    return send(res, { source: 'Supabase', prices, references: referenceRows, formula: '0.7 median trades + 0.3 median listings; listings only when no trades', counts: { trades: tradeRows.filter(recent).length, listings: listingRows.filter(recent).length } })
  } catch (error) {
    console.error('[v0] price engine failed', error)
    return send(res, { source: 'Supabase', prices: [], references: [], error: 'Real price data unavailable' }, 200)
  }
}
