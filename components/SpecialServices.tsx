'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BadgeCheck, CloudSun, Warehouse, X } from 'lucide-react'
import { createClient } from '../lib/supabase'

const serviceTabs = ['Transport', 'Storage', 'Weather', 'Value Added', 'Veterinary', 'Mushroom Spawn', 'Agri Services', 'Daraja Escrow', 'Quality Check'] as const
type ServiceTab = typeof serviceTabs[number]
type Row = Record<string, unknown>
type Hub = Row & { id: string; name: string; latitude?: number; longitude?: number }
type Weather = { hub_id: string; hub: string; temperature: number; humidity: number; precipitation: number; condition: string; fetched_at?: string }
const agriTypes = ['Soil Testing', 'Crop Advisory', 'Seeds', 'Irrigation', 'Greenhouse', 'Fish Farming']
const requestEmail = 'mycogoldafrica.org@gmail.com'

function field(row: Row, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value !== null && value !== undefined && value !== '') return value
  }
  return null
}

function label(row: Row, ...keys: string[]) {
  const value = field(row, ...keys)
  return value === null ? '—' : String(value)
}

function numeric(row: Row, ...keys: string[]) {
  const value = Number(field(row, ...keys))
  return Number.isFinite(value) ? value : 0
}

function stars(value: unknown) {
  const rating = Number(value)
  if (!Number.isFinite(rating)) return 'No ratings'
  const count = Math.max(0, Math.min(5, Math.round(rating)))
  return `${'★'.repeat(count)}${'☆'.repeat(5 - count)} ${rating.toFixed(1)}`
}

function matchesHub(row: Row, hub: Hub | null) {
  if (!hub) return true
  const related = [
    field(row, 'hub_id', 'origin_hub_id', 'from_hub_id', 'destination_hub_id', 'to_hub_id'),
    field(row, 'hub', 'hub_name', 'location', 'origin_hub', 'from_hub', 'destination_hub', 'to_hub'),
  ].filter(value => value !== null).map(String)
  return related.includes(hub.id) || related.some(value => value.toLowerCase() === hub.name.toLowerCase())
}

function requestHref(service: string, hub: Hub | null) {
  const subject = encodeURIComponent(`${service} listing request${hub ? ` - ${hub.name}` : ''}`)
  const body = encodeURIComponent(`Please contact me about listing ${service}${hub ? ` in ${hub.name}` : ''}.`)
  return `mailto:${requestEmail}?subject=${subject}&body=${body}`
}

export function SpecialServices({ userId }: { userId: string | null }) {
  const [tab, setTab] = useState<ServiceTab>('Transport')
  const [hubs, setHubs] = useState<Hub[]>([])
  const [selectedHubId, setSelectedHubId] = useState('')
  const [providers, setProviders] = useState<Row[]>([])
  const [storage, setStorage] = useState<Row[]>([])
  const [weather, setWeather] = useState<Weather | null>(null)
  const [products, setProducts] = useState<Row[]>([])
  const [veterinary, setVeterinary] = useState<Row[]>([])
  const [spawn, setSpawn] = useState<Row[]>([])
  const [agriServices, setAgriServices] = useState<Row[]>([])
  const [payments, setPayments] = useState<Row[]>([])
  const [paymentEnabled, setPaymentEnabled] = useState(false)
  const [trades, setTrades] = useState<Row[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Row | null>(null)
  const [profitKg, setProfitKg] = useState('')
  const [category, setCategory] = useState('All categories')
  const [species, setSpecies] = useState('All species')
  const [agriType, setAgriType] = useState('All services')
  const [qualityTrade, setQualityTrade] = useState('')
  const [grade, setGrade] = useState('A')
  const [quantity, setQuantity] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [gps, setGps] = useState<{ latitude: number; longitude: number } | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const selectedHub = hubs.find(hub => hub.id === selectedHubId) || null
  const categories = useMemo(() => ['All categories', ...new Set(products.map(row => field(row, 'category')).filter((value): value is string => typeof value === 'string' && value.trim().length > 0))], [products])
  const speciesOptions = useMemo(() => ['All species', ...new Set(spawn.map(row => field(row, 'species')).filter((value): value is string => typeof value === 'string' && value.trim().length > 0))], [spawn])

  useEffect(() => {
    let active = true
    async function loadHubs() {
      try {
        const { data, error: queryError } = await createClient().from('hubs').select('*').order('name')
        if (queryError) throw queryError
        if (active) setHubs((data || []) as Hub[])
      } catch {
        if (active) setError('Could not load hubs.')
      }
    }
    void loadHubs()
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const supabase = createClient()
    setError('')
    async function loadTab() {
      setLoading(true)
      try {
        if (tab === 'Transport') {
          const { data, error: queryError } = await supabase.from('logistics_providers').select('*').eq('status', 'VERIFIED')
          if (queryError) throw queryError
          if (active) setProviders(((data || []) as Row[]).filter(row => matchesHub(row, selectedHub)))
        } else if (tab === 'Storage') {
          const { data, error: queryError } = await supabase.from('storage_locations').select('*').eq('status', 'VERIFIED')
          if (queryError) throw queryError
          if (active) setStorage(((data || []) as Row[]).filter(row => matchesHub(row, selectedHub)))
        } else if (tab === 'Weather') {
          if (!selectedHub) {
            if (active) setWeather(null)
            return
          }
          const { data: cached, error: cacheError } = await supabase.from('weather_cache').select('*').eq('city', selectedHub.name).maybeSingle()
          if (cacheError) throw cacheError
          if (cached && active) setWeather(normalizeWeather(cached as Row, selectedHub))
          const response = await fetch(`/api/weather?hub_id=${encodeURIComponent(selectedHub.id)}`, { cache: 'no-store' })
          const result = await response.json()
          if (!response.ok || !result.weather) throw new Error('Weather unavailable')
          if (active) setWeather(result.weather as Weather)
        } else if (tab === 'Value Added') {
          const { data, error: queryError } = await supabase.from('value_added_products').select('*')
          if (queryError) throw queryError
          if (active) setProducts(((data || []) as Row[]).filter(row => matchesHub(row, selectedHub)))
        } else if (tab === 'Veterinary') {
          const { data, error: queryError } = await supabase.from('veterinary_services').select('*')
          if (queryError) throw queryError
          if (active) setVeterinary(((data || []) as Row[]).filter(row => matchesHub(row, selectedHub)))
        } else if (tab === 'Mushroom Spawn') {
          const { data, error: queryError } = await supabase.from('mushroom_spawn').select('*')
          if (queryError) throw queryError
          if (active) setSpawn(((data || []) as Row[]).filter(row => matchesHub(row, selectedHub)))
        } else if (tab === 'Agri Services') {
          const { data, error: queryError } = await supabase.from('agri_services').select('*')
          if (queryError) throw queryError
          if (active) setAgriServices(((data || []) as Row[]).filter(row => matchesHub(row, selectedHub)))
        } else if (tab === 'Daraja Escrow') {
          const [configResponse, paymentsResult] = await Promise.all([
            fetch('/api/payments/config', { cache: 'no-store' }),
            supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(100),
          ])
          const config = await configResponse.json()
          if (paymentsResult.error) throw paymentsResult.error
          const orderIds = [...new Set((paymentsResult.data || []).map(payment => payment.order_id))]
          const { data: orders, error: orderError } = orderIds.length
            ? await supabase.from('orders').select('id,listing_id,status').in('id', orderIds)
            : { data: [], error: null }
          if (orderError) throw orderError
          const listingIds = [...new Set((orders || []).map(order => order.listing_id))]
          const { data: listings, error: listingError } = listingIds.length
            ? await supabase.from('listings').select('*').in('id', listingIds)
            : { data: [], error: null }
          if (listingError) throw listingError
          const ordersById = new Map((orders || []).map(order => [order.id, order]))
          const listingsById = new Map((listings || []).map(row => [row.id, row as Row]))
          const paymentRows = (paymentsResult.data || []).map(payment => {
            const order = ordersById.get(payment.order_id)
            const listing = order ? listingsById.get(order.listing_id) : null
            return { ...payment, order_status: order?.status || null, hub_id: listing?.hub_id || null, hub: listing?.hub || listing?.hub_name || listing?.location || null }
          }).filter(row => matchesHub(row as Row, selectedHub))
          if (active) {
            setPaymentEnabled(config.enabled === true)
            setPayments(paymentRows as Row[])
          }
        } else if (tab === 'Quality Check' && userId) {
          const { data: orders, error: orderError } = await supabase.from('orders')
            .select('id,listing_id,quantity,status')
            .in('status', ['PAID_ESCROW', 'PENDING_VERIFICATION', 'COMPLETED'])
            .order('created_at', { ascending: false }).limit(200)
          if (orderError) throw orderError
          const listingIds = [...new Set((orders || []).map(order => order.listing_id))]
          const { data: listings, error: listingError } = listingIds.length
            ? await supabase.from('listings').select('id,hub_id,hub,location').in('id', listingIds)
            : { data: [], error: null }
          if (listingError) throw listingError
          const listingById = new Map((listings || []).map(row => [row.id, row as Row]))
          const tradeIds = (orders || []).filter(order => matchesHub(listingById.get(order.listing_id) || {}, selectedHub)).map(order => order.id)
          const { data: verifiedRows, error: tradeError } = tradeIds.length
            ? await supabase.from('verified_trades').select('trade_id,category,variety,verified_kg').in('trade_id', tradeIds)
            : { data: [], error: null }
          if (tradeError) throw tradeError
          if (active) setTrades((verifiedRows || []) as Row[])
        }
      } catch (cause) {
        if (active) {
          const detail = cause instanceof Error ? cause.message : ''
          setError(tab === 'Weather' ? 'Weather unavailable' : detail || `Could not load ${tab.toLowerCase()} data.`)
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadTab()
    return () => { active = false }
  }, [tab, userId, selectedHubId])

  function captureGps() {
    setGps(null)
    if (!navigator.geolocation) {
      setError('GPS is unavailable on this device.')
      return
    }
    navigator.geolocation.getCurrentPosition(position => {
      setGps({ latitude: position.coords.latitude, longitude: position.coords.longitude })
      setError('')
    }, () => setError('Enable GPS to submit a quality check.'), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  }

  async function submitQualityCheck(event: FormEvent) {
    event.preventDefault()
    if (!userId) return setError('Sign in to submit a quality check.')
    if (!qualityTrade || !photo || !gps || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
      setError('Select a trade, enter quantity, add a photo, and capture GPS.')
      return
    }
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sign in to submit a quality check.')
      const uploadForm = new FormData()
      uploadForm.append('file', photo)
      const uploadResponse = await fetch('/api/listings/photo', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: uploadForm })
      const upload = await uploadResponse.json()
      if (!uploadResponse.ok || typeof upload.path !== 'string') throw new Error(upload.error || 'Photo upload failed.')
      const { error: insertError } = await supabase.from('quality_checks').insert({
        trade_id: qualityTrade, user_id: userId, grade, quantity_kg: Number(quantity), photo_path: upload.path,
        latitude: gps.latitude, longitude: gps.longitude, notes: notes.trim() || null,
      })
      if (insertError) throw insertError
      setMessage(grade === 'REJECT' ? 'Rejected quality check recorded. Admin trade verification will be blocked.' : 'Quality check submitted.')
      setQualityTrade(''); setQuantity(''); setPhoto(null); setGps(null); setNotes('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit the quality check.')
    } finally { setLoading(false) }
  }

  const visibleProducts = products.filter(row => category === 'All categories' || String(field(row, 'category')).toLowerCase() === category.toLowerCase())
  const visibleSpawn = spawn.filter(row => species === 'All species' || String(field(row, 'species')).toLowerCase() === species.toLowerCase())
  const visibleAgri = agriServices.filter(row => agriType === 'All services' || String(field(row, 'service_type', 'type')).toLowerCase() === agriType.toLowerCase())
  const filteredVeterinary = veterinary

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto border-b border-white/10 pb-3" role="tablist" aria-label="Special services">
        {serviceTabs.map(item => <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? 'gold-btn min-h-10 shrink-0' : 'ghost-btn min-h-10 shrink-0'} onClick={() => { setTab(item); setError(''); setMessage('') }}>{item}</button>)}
      </div>
      <label className="flex max-w-sm items-center gap-3 text-sm">Hub
        <select className="field min-h-10" value={selectedHubId} onChange={event => setSelectedHubId(event.target.value)} aria-label="Filter services by hub">
          <option value="">All hubs</option>{hubs.map(hub => <option value={hub.id} key={hub.id}>{hub.name}</option>)}
        </select>
      </label>
      {loading && <p className="muted text-sm">Loading {tab.toLowerCase()}…</p>}
      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

      {tab === 'Transport' && <section aria-label="Verified transport providers">
        {providers.length ? <div className="divide-y divide-white/10">{providers.map((row, index) => <article key={String(field(row, 'id') || index)} className="grid gap-2 py-4 sm:grid-cols-2">
          <div><h3 className="font-semibold">{label(row, 'name', 'provider_name')}</h3><p className="muted mt-1 text-sm">{label(row, 'vehicle', 'vehicle_type')} · {label(row, 'location', 'hub_name', 'hub')}</p></div>
          <div className="sm:text-right"><p>{label(row, 'from_hub', 'origin_hub', 'from_location')} → {label(row, 'to_hub', 'destination_hub', 'to_location')}</p><p className="mt-1 text-sm gold">KES {label(row, 'price_per_kg', 'price_kg')} / kg · {stars(field(row, 'rating', 'average_rating'))}</p><p className="muted mt-1 text-xs">On-time {label(row, 'on_time_rate')} · {label(row, 'total_trips')} trips</p></div>
        </article>)}</div> : <EmptyState service="transport provider" hub={selectedHub} />}
      </section>}

      {tab === 'Storage' && <section aria-label="Verified storage locations">{storage.length ? <div className="divide-y divide-white/10">{storage.map((row, index) => <article key={String(field(row, 'id') || index)} className="grid gap-2 py-4 sm:grid-cols-2">
        <div><h3 className="font-semibold">{label(row, 'name', 'location_name')}</h3><p className="muted mt-1 text-sm">{label(row, 'hub_name', 'hub', 'location')}</p></div>
        <div className="sm:text-right"><span className="rounded bg-white/10 px-2 py-1 text-xs">{String(field(row, 'storage_type', 'type') || (field(row, 'is_cold', 'cold_storage') ? 'Cold' : 'Dry'))}</span><p className="mt-2 text-sm">{label(row, 'available_kg')} / {label(row, 'capacity_kg', 'capacity')} kg available</p><p className="mt-1 text-sm gold">KES {label(row, 'price_per_day', 'daily_price')} / day · {stars(field(row, 'rating', 'average_rating'))}</p></div>
      </article>)}</div> : <EmptyState service="storage listing" hub={selectedHub} />}</section>}

      {tab === 'Weather' && <section aria-label="Hub weather">{weather ? <div className="flex flex-wrap items-center justify-between gap-4 border-y border-white/10 py-5"><div><div className="flex items-center gap-2"><CloudSun className="gold" size={18}/><h3 className="font-semibold">{weather.hub}</h3></div><p className="muted mt-2 text-sm">{weather.condition} · {weather.humidity}% humidity · {weather.precipitation} mm rainfall</p><p className="gold mt-1 text-xs">Updated {weather.fetched_at ? new Date(weather.fetched_at).toLocaleString() : 'just now'}</p></div><p className="text-3xl font-semibold">{weather.temperature}°C</p></div> : !loading && <p className="muted text-sm">{selectedHub ? 'Weather unavailable' : 'Select a hub with coordinates to view weather.'}</p>}</section>}

      {tab === 'Value Added' && <section aria-label="Value-added products">
        <div className="mb-3 flex flex-wrap gap-3"><select className="field min-h-10 w-auto" value={category} onChange={event => setCategory(event.target.value)}><option>All categories</option>{categories.slice(1).map(item => <option key={item}>{item}</option>)}</select></div>
        {visibleProducts.length ? <div className="divide-y divide-white/10">{visibleProducts.map((row, index) => <button type="button" key={String(field(row, 'id') || index)} className="grid w-full gap-2 py-4 text-left sm:grid-cols-2" onClick={() => { setSelectedProduct(row); setProfitKg('') }}>
          <div><h3 className="font-semibold">{label(row, 'name', 'product_name')}</h3><p className="muted mt-1 text-sm">{label(row, 'base_crop')} · {label(row, 'process')}</p></div>
          <div className="sm:text-right"><p className="text-sm">Shelf life {label(row, 'shelf_life')}</p><p className="mt-1 text-sm gold">KES {label(row, 'price_kes', 'price_per_kg', 'price')} · {label(row, 'margin_percent', 'margin')}% margin · {stars(field(row, 'rating', 'average_rating'))}</p></div>
        </button>)}</div> : <EmptyState service="value-added product" hub={selectedHub} />}
      </section>}

      {tab === 'Veterinary' && <section aria-label="Veterinary services">{filteredVeterinary.length ? <div className="divide-y divide-white/10">{filteredVeterinary.map((row, index) => { const phone = String(field(row, 'phone', 'phone_number', 'contact_phone') || ''); return <article key={String(field(row, 'id') || index)} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><h3 className="font-semibold">{label(row, 'service_type')}</h3><p className="muted mt-1 text-sm">{label(row, 'animal_type')} · {label(row, 'hub_name', 'hub')}</p><p className="mt-1 text-sm gold">KES {label(row, 'price', 'price_kes')} · {stars(field(row, 'rating', 'average_rating'))}</p></div><a className={`ghost-btn inline-flex min-h-10 items-center ${phone ? '' : 'pointer-events-none opacity-50'}`} href={phone ? `tel:${phone}` : undefined}>Call</a></article>})}</div> : <EmptyState service="veterinary service" hub={selectedHub} />}</section>}

      {tab === 'Mushroom Spawn' && <section aria-label="Mushroom spawn listings">
        <select className="field mb-3 min-h-10 w-auto" value={species} onChange={event => setSpecies(event.target.value)}><option>All species</option>{speciesOptions.slice(1).map(item => <option key={item}>{item}</option>)}</select>
        {visibleSpawn.length ? <div className="divide-y divide-white/10">{visibleSpawn.map((row, index) => <article key={String(field(row, 'id') || index)} className="grid gap-2 py-4 sm:grid-cols-2"><div><h3 className="font-semibold">{label(row, 'species')}</h3><p className="muted mt-1 text-sm">{label(row, 'spawn_type')} · {label(row, 'substrate')}</p><p className="muted mt-1 text-xs">Incubation {label(row, 'incubation_days')} days · Yield {label(row, 'yield_kg_per_bag')} kg/bag</p></div><div className="sm:text-right"><p className="gold">KES {label(row, 'price', 'price_kes')}</p><p className="muted mt-1 text-sm">Stock {label(row, 'stock', 'stock_quantity')} · {stars(field(row, 'rating', 'average_rating'))}</p></div></article>)}</div> : <EmptyState service="mushroom spawn listing" hub={selectedHub} />}
      </section>}

      {tab === 'Agri Services' && <section aria-label="Agricultural services">
        <select className="field mb-3 min-h-10 w-auto" value={agriType} onChange={event => setAgriType(event.target.value)}><option>All services</option>{agriTypes.map(item => <option key={item}>{item}</option>)}</select>
        {visibleAgri.length ? <div className="divide-y divide-white/10">{visibleAgri.map((row, index) => <article key={String(field(row, 'id') || index)} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><h3 className="font-semibold">{label(row, 'service_type', 'type')}</h3><p className="muted mt-1 text-sm">{label(row, 'description')}</p><p className="muted mt-1 text-xs">{label(row, 'hub_name', 'hub')}</p></div><p className="text-sm gold">KES {label(row, 'price', 'price_kes')} · {stars(field(row, 'rating', 'average_rating'))}</p></article>)}</div> : <EmptyState service="agricultural service" hub={selectedHub} />}
      </section>}

      {tab === 'Daraja Escrow' && <section aria-label="Daraja escrow status">
        <div className="my-3 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">{['Buyer Pays (STK)', 'Held', 'Delivery Confirmed', 'Released'].map((step, index) => <div key={step} className="border border-white/10 p-3"><span className="gold">{index + 1}</span><p className="mt-1">{step}</p></div>)}</div>
        {!paymentEnabled && <p className="mb-4 border-l-2 border-amber-400 pl-3 text-sm text-amber-300">Escrow not enabled yet - do not send funds</p>}
        {payments.length ? <div className="divide-y divide-white/10">{payments.map((row, index) => <article key={String(field(row, 'id') || index)} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><div><p>Order {String(field(row, 'order_id')).slice(0, 8)} · {label(row, 'status')}</p><p className="muted mt-1 text-xs">{new Date(String(field(row, 'created_at'))).toLocaleString()}</p></div><p className="gold">KES {numeric(row, 'amount_kes').toLocaleString()}</p></article>)}</div> : !loading && <EmptyState service="escrow order" hub={selectedHub} />}
      </section>}

      {tab === 'Quality Check' && <section aria-label="Submit quality check">
        {userId && !loading && trades.length === 0 && <div className="mb-4"><EmptyState service="verified trade for quality check" hub={selectedHub} /></div>}
        {!userId ? <p className="muted text-sm">Sign in to submit a quality check.</p> : <form className="grid gap-3 sm:grid-cols-2" onSubmit={submitQualityCheck}>
          <label className="text-sm sm:col-span-2">Trade<select className="field mt-1" value={qualityTrade} onChange={event => setQualityTrade(event.target.value)} required><option value="">Select a verified trade</option>{trades.map((row, index) => <option key={String(field(row, 'trade_id') || index)} value={String(field(row, 'trade_id'))}>{label(row, 'category')} · {label(row, 'variety')} · {String(field(row, 'trade_id')).slice(0, 8)}</option>)}</select></label>
          <label className="text-sm">Grade<select className="field mt-1" value={grade} onChange={event => setGrade(event.target.value)}>{['A', 'B', 'C', 'REJECT'].map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="text-sm">Quantity (kg)<input className="field mt-1" type="number" min="0.01" step="0.01" value={quantity} onChange={event => setQuantity(event.target.value)} required /></label>
          <label className="text-sm">Photo<input className="field mt-1" type="file" accept="image/*" capture="environment" onChange={event => setPhoto(event.target.files?.[0] || null)} required /></label>
          <button className="ghost-btn min-h-11" type="button" onClick={captureGps}>{gps ? `GPS ${gps.latitude.toFixed(4)}, ${gps.longitude.toFixed(4)}` : 'Capture GPS'}</button>
          <label className="text-sm sm:col-span-2">Notes<textarea className="field mt-1 min-h-20" value={notes} onChange={event => setNotes(event.target.value)} maxLength={1000} /></label>
          <button className="gold-btn min-h-11 sm:col-span-2" type="submit" disabled={loading}>{loading ? 'Submitting…' : 'Submit quality check'}</button>
        </form>}
      </section>}

      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      {message && <p className="text-sm gold" role="status">{message}</p>}
      <p className="muted flex items-center gap-2 border-t border-white/10 pt-3 text-xs"><BadgeCheck size={14} className="gold"/> Service records are read from Supabase.</p>

      {selectedProduct && <ValueAddedDetail product={selectedProduct} kg={profitKg} setKg={setProfitKg} onClose={() => setSelectedProduct(null)} />}
    </div>
  )
}

function EmptyState({ service, hub }: { service: string; hub: Hub | null }) {
  const href = requestHref(service, hub)
  return <div className="border-y border-white/10 py-5"><p className="text-sm muted">No verified {service} in this hub yet - Be first to list</p><a className="gold mt-3 inline-flex min-h-10 items-center" href={href}>Request listing</a></div>
}

function normalizeWeather(row: Row, hub: Hub): Weather {
  const nested = field(row, 'weather_data') as Row | null
  const value = nested && typeof nested === 'object' ? nested : row
  return {
    hub_id: hub.id,
    hub: hub.name,
    temperature: numeric(value, 'temperature', 'temperature_2m'),
    humidity: numeric(value, 'humidity', 'relative_humidity_2m'),
    precipitation: numeric(value, 'precipitation', 'rainfall'),
    condition: label(value, 'condition', 'weather_condition'),
    fetched_at: String(field(row, 'fetched_at', 'updated_at') || ''),
  }
}

function ValueAddedDetail({ product, kg, setKg, onClose }: { product: Row; kg: string; setKg: (value: string) => void; onClose: () => void }) {
  const price = numeric(product, 'price_kes', 'price_per_kg', 'price')
  const marginPercent = numeric(product, 'margin_percent', 'margin')
  const quantity = Math.max(0, Number(kg) || 0)
  const output = quantity * price
  const margin = output * marginPercent / 100
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-black/80 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="glass w-full max-w-xl p-5" role="dialog" aria-modal="true" aria-labelledby="value-added-title">
      <header className="flex items-start justify-between gap-4"><div><p className="mono text-xs gold">VALUE ADDED</p><h2 id="value-added-title" className="mt-1 text-xl font-bold">{label(product, 'name', 'product_name')}</h2></div><button type="button" className="ghost-btn p-2" aria-label="Close detail" onClick={onClose}><X size={18}/></button></header>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="muted">Base crop</dt><dd>{label(product, 'base_crop')}</dd></div><div><dt className="muted">Process</dt><dd>{label(product, 'process')}</dd></div><div><dt className="muted">Shelf life</dt><dd>{label(product, 'shelf_life')}</dd></div><div><dt className="muted">Rating</dt><dd>{stars(field(product, 'rating', 'average_rating'))}</dd></div></dl>
      <div className="mt-4 border-t border-white/10 pt-4"><h3 className="text-sm font-semibold">Description</h3><p className="muted mt-1 text-sm">{label(product, 'description')}</p><h3 className="mt-4 text-sm font-semibold">How to make</h3><p className="muted mt-1 whitespace-pre-wrap text-sm">{label(product, 'how_to_make', 'production_steps')}</p></div>
      <div className="mt-4 border-t border-white/10 pt-4"><label className="block text-sm">Input quantity (kg)<input className="field mt-1" type="number" min="0" step="0.1" value={kg} onChange={event => setKg(event.target.value)} /></label><div className="mt-3 flex justify-between text-sm"><span>Output value</span><strong className="gold">KES {output.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></div><div className="mt-1 flex justify-between text-sm"><span>Estimated margin ({marginPercent}%)</span><strong>KES {margin.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></div></div>
    </section>
  </div>
}
