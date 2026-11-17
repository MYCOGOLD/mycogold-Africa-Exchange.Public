'use client'

import { useMemo, useState } from 'react'
import { Activity, MapPin, Sparkles, TriangleAlert } from 'lucide-react'
import type { Listing } from './types'

type MarketRow = Listing & { title?: string | null; variety?: string | null }

const normalize = (value: string | null | undefined) => (value || '').trim().toLocaleLowerCase()
const nameOf = (row: Listing) => (row.product || row.category || 'Unspecified produce').trim()
const medianOf = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
const money = (value: number) => `KES ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

export function MarketIntelligence({ listings }: { listings: Listing[] }) {
  const [product, setProduct] = useState('')
  const [location, setLocation] = useState('')
  const [priceLimit, setPriceLimit] = useState('')

  const products = useMemo(() => [...new Set(listings.map(nameOf).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [listings])
  const locations = useMemo(() => [...new Set(listings.map(row => row.location?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b)), [listings])
  const selectedProduct = product || products[0] || ''
  const cohort = useMemo(() => listings.filter(row => normalize(nameOf(row)) === normalize(selectedProduct)), [listings, selectedProduct])
  const prices = cohort.map(row => Number(row.price)).filter(value => Number.isFinite(value) && value > 0)
  const median = prices.length ? medianOf(prices) : null
  const low = prices.length ? Math.min(...prices) : null
  const high = prices.length ? Math.max(...prices) : null
  const target = Number(priceLimit)
  const ranked = useMemo(() => cohort
    .filter(row => Number(row.price) > 0)
    .map(row => {
      const price = Number(row.price)
      const hasLocation = Boolean(location)
      const locationMatch = hasLocation && normalize(row.location) === normalize(location)
      const priceScore = median ? Math.max(0, 40 * (1 - Math.min(Math.abs(price - median) / median, 1))) : 0
      const stockScore = Number(row.quantity) > 0 ? 25 : 0
      const locationScore = hasLocation ? (locationMatch ? 20 : 0) : 10
      const targetScore = Number.isFinite(target) && target > 0 ? (price <= target ? 15 : 0) : 15
      const score = Math.round(priceScore + stockScore + locationScore + targetScore)
      return { row, score, price, locationMatch }
    })
    .sort((a, b) => b.score - a.score || a.price - b.price)
    .slice(0, 3), [cohort, location, median, target])

  const confidence = prices.length >= 8 ? 'More listings' : prices.length >= 3 ? 'Some evidence' : 'Limited evidence'
  const confidenceClass = prices.length >= 8 ? 'text-[#68ff91]' : prices.length >= 3 ? 'gold' : 'text-[#ffcf70]'
  const spread = median && low !== null && high !== null ? (high - low) / median : 0
  const staleCount = cohort.filter(row => {
    const timestamp = row.updated_at || row.created_at
    return timestamp ? Date.now() - new Date(timestamp).getTime() > 14 * 24 * 60 * 60 * 1000 : true
  }).length

  return <section className="glass p-4 md:p-5" aria-labelledby="market-intelligence-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="mono text-[10px] uppercase tracking-[.22em] gold"><Sparkles className="mr-1 inline" size={12}/> TUSK · MARKET INTELLIGENCE</p>
        <h2 id="market-intelligence-title" className="mt-2 text-xl font-bold">Turn listings into a clearer decision.</h2>
        <p className="muted mt-1 text-sm">Live analysis of the listings currently loaded in this market view.</p>
      </div>
      <span className="rounded-full border border-white/10 px-3 py-1 text-xs muted">Explainable signals · v1</span>
    </div>

    {!listings.length ? <div className="mt-4 rounded-xl border border-white/10 p-4 text-sm muted">No listings are available to analyze yet. When listings appear, TUSK will compare their asking prices and freshness.</div> : <>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-xs muted">Produce
          <select className="field mt-1 min-h-11" value={selectedProduct} onChange={event => setProduct(event.target.value)}>
            {products.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs muted">Preferred location (optional)
          <select className="field mt-1 min-h-11" value={location} onChange={event => setLocation(event.target.value)}>
            <option value="">Any location</option>
            {locations.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs muted">Your target price in KES (optional)
          <input className="field mt-1 min-h-11" type="number" min="0" inputMode="decimal" placeholder="Enter your limit" value={priceLimit} onChange={event => setPriceLimit(event.target.value)}/>
        </label>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Signal label="Comparable listings" value={String(cohort.length)} note="Same named product"/>
        <Signal label="Median asking price" value={median === null ? '—' : money(median)} note="Not a verified trade price"/>
        <Signal label="Observed price range" value={low === null || high === null ? '—' : `${money(low)} – ${money(high)}`} note="Listing prices only"/>
        <Signal label="Evidence strength" value={confidence} note={`${prices.length} priced listings`} tone={confidenceClass}/>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-2 font-semibold"><Activity size={16} className="gold"/>Suggested listings to review</div>
          {ranked.length ? <div className="mt-3 space-y-2">{ranked.map(({ row, score, price, locationMatch }) => {
            const data = row as MarketRow
            return <article key={row.id} className="rounded-lg bg-white/[.035] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><b>{row.seller || 'Seller'}</b><span className="gold">{money(price)}</span></div>
              <p className="mt-1 text-xs muted"><MapPin className="mr-1 inline" size={12}/>{row.location || 'Location not given'} · {row.quantity ? `${row.quantity} listed` : 'Quantity not given'} · match {score}/100</p>
              {data.variety && <p className="mt-1 text-xs muted">Variety: {data.variety}</p>}
              {location && locationMatch && <p className="mt-1 text-xs text-[#68ff91]">Matches your selected location</p>}
            </article>
          })}</div> : <p className="mt-3 text-sm muted">No priced listing in this product group.</p>}
          <p className="mt-3 text-[11px] muted">Match score combines price proximity (40%), stated stock (25%), location preference (20% when selected), and target-price fit (15%). It ranks what to inspect; it does not verify quality or availability.</p>
        </div>

        <div className="rounded-xl border border-[#ffd60a]/20 bg-[#ffd60a]/[.045] p-4">
          <div className="flex items-center gap-2 font-semibold"><TriangleAlert size={16} className="gold"/>What to verify</div>
          <ul className="mt-3 space-y-2 text-sm muted">
            <li>• Confirm price units, grade, packaging, and quantity match before comparing.</li>
            <li>• {spread > 0.35 ? 'Prices vary widely; confirm quality and transport terms before choosing.' : 'Ask sellers to confirm today’s price and available stock.'}</li>
            <li>• {staleCount ? `${staleCount} listing${staleCount === 1 ? ' may be' : 's may be'} older than 14 days or missing an update date.` : 'Listing dates are recent, but this does not confirm stock is still available.'}</li>
          </ul>
          <p className="mt-3 border-t border-white/10 pt-3 text-xs">This is deterministic analysis of displayed listings. No external AI model is connected and no recommendation is a guarantee.</p>
        </div>
      </div>
    </>}
  </section>
}

function Signal({ label, value, note, tone = 'gold' }: { label: string; value: string; note: string; tone?: string }) {
  return <div className="rounded-xl border border-white/10 p-3">
    <p className="text-[11px] muted">{label}</p><p className={`mt-2 break-words text-sm font-semibold ${tone}`}>{value}</p><p className="mt-1 text-[10px] muted">{note}</p>
  </div>
}

