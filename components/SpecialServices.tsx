'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { BadgeCheck, CloudSun, ShieldCheck, Warehouse, Truck } from 'lucide-react'
import { createClient } from '../lib/supabase'

const serviceTabs = ['Transport', 'Storage', 'Weather', 'Daraja Escrow', 'Quality Check'] as const
type ServiceTab = typeof serviceTabs[number]
type Row = Record<string, unknown>
type Weather = { city: string; temperature: number; humidity: number; precipitation: number; condition: string; bestFor: string }

function field(row: Row, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value !== null && value !== undefined && value !== '') return value
  }
  return null
}

function text(row: Row, ...keys: string[]) {
  const value = field(row, ...keys)
  return value === null ? '—' : String(value)
}

function stars(value: unknown) {
  const rating = Number(value)
  if (!Number.isFinite(rating)) return 'No ratings'
  const count = Math.max(0, Math.min(5, Math.round(rating)))
  return `${'★'.repeat(count)}${'☆'.repeat(5 - count)} ${rating.toFixed(1)}`
}

export function SpecialServices({ userId }: { userId: string | null }) {
  const [tab, setTab] = useState<ServiceTab>('Transport')
  const [hub, setHub] = useState('All hubs')
  const [providers, setProviders] = useState<Row[]>([])
  const [storage, setStorage] = useState<Row[]>([])
  const [weather, setWeather] = useState<Weather[]>([])
  const [payments, setPayments] = useState<Row[]>([])
  const [paymentEnabled, setPaymentEnabled] = useState(false)
  const [trades, setTrades] = useState<Row[]>([])
  const [qualityTrade, setQualityTrade] = useState('')
  const [grade, setGrade] = useState('A')
  const [quantity, setQuantity] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [gps, setGps] = useState<{ latitude: number; longitude: number } | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    const supabase = createClient()
    setError('')

    async function load() {
      setLoading(true)
      try {
        if (tab === 'Transport') {
          const { data, error: queryError } = await supabase.from('logistics_providers').select('*').eq('status', 'VERIFIED')
          if (queryError) throw queryError
          if (active) setProviders((data || []) as Row[])
        } else if (tab === 'Storage') {
          const { data, error: queryError } = await supabase.from('storage_locations').select('*').eq('status', 'VERIFIED')
          if (queryError) throw queryError
          if (active) setStorage((data || []) as Row[])
        } else if (tab === 'Weather') {
          const response = await fetch('/api/weather', { cache: 'no-store' })
          const result = await response.json()
          if (!response.ok) throw new Error('Weather unavailable')
          if (active) setWeather(result.weather || [])
        } else if (tab === 'Daraja Escrow') {
          const [configResponse, paymentsResponse] = await Promise.all([
            fetch('/api/payments/config', { cache: 'no-store' }),
            fetch('/api/payments/escrow', { cache: 'no-store' }),
          ])
          const config = await configResponse.json()
          const result = await paymentsResponse.json()
          if (!paymentsResponse.ok) throw new Error(result.error || 'Could not load escrow orders.')
          if (active) {
            setPaymentEnabled(config.enabled === true)
            setPayments(result.payments || [])
          }
        } else if (tab === 'Quality Check' && userId) {
          const { data, error: queryError } = await supabase
            .from('orders')
            .select('id,listing_id,quantity,status')
            .in('status', ['PAID_ESCROW', 'COMPLETED'])
            .order('created_at', { ascending: false })
            .limit(100)
          if (queryError) throw queryError
          const ids = [...new Set((data || []).map(order => order.id))]
          const { data: verifiedRows, error: verifyError } = ids.length
            ? await supabase.from('verified_trades').select('trade_id,category,variety,verified_kg').in('trade_id', ids)
            : { data: [], error: null }
          if (verifyError) throw verifyError
          if (active) setTrades((verifiedRows || []) as Row[])
        }
      } catch {
        if (active) setError(tab === 'Weather' ? 'Weather unavailable' : `Could not load ${tab.toLowerCase()} data.`)
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => { active = false }
  }, [tab, userId])

  const hubs = [...new Set(providers.flatMap(provider => [
    field(provider, 'from_hub', 'origin_hub', 'from_location', 'origin'),
    field(provider, 'to_hub', 'destination_hub', 'to_location', 'destination'),
    field(provider, 'hub', 'location'),
  ]).filter((value): value is string => typeof value === 'string'))].sort()
  const visibleProviders = providers.filter(provider => hub === 'All hubs' || [
    field(provider, 'from_hub', 'origin_hub', 'from_location', 'origin'),
    field(provider, 'to_hub', 'destination_hub', 'to_location', 'destination'),
    field(provider, 'hub', 'location'),
  ].includes(hub))

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
    if (!userId) {
      setError('Sign in to submit a quality check.')
      return
    }
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
      const uploadResponse = await fetch('/api/listings/photo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: uploadForm,
      })
      const upload = await uploadResponse.json()
      if (!uploadResponse.ok || typeof upload.path !== 'string') throw new Error(upload.error || 'Photo upload failed.')

      const { error: insertError } = await supabase.from('quality_checks').insert({
        trade_id: qualityTrade,
        user_id: userId,
        grade,
        quantity_kg: Number(quantity),
        photo_path: upload.path,
        latitude: gps.latitude,
        longitude: gps.longitude,
        notes: notes.trim() || null,
      })
      if (insertError) throw insertError
      setMessage(grade === 'REJECT' ? 'Rejected quality check recorded. Admin trade verification will be blocked.' : 'Quality check submitted.')
      setQualityTrade('')
      setQuantity('')
      setPhoto(null)
      setGps(null)
      setNotes('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit the quality check.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto border-b border-white/10 pb-3" role="tablist" aria-label="Special services">
        {serviceTabs.map(item => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? 'gold-btn min-h-10 shrink-0' : 'ghost-btn min-h-10 shrink-0'} onClick={() => setTab(item)}>{item}</button>
        ))}
      </div>

      {tab === 'Transport' && <section aria-label="Verified transport providers">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Verified transport providers</h2>
          <select className="field min-h-10 w-auto" value={hub} onChange={event => setHub(event.target.value)} aria-label="Filter transport by hub">
            <option>All hubs</option>{hubs.map(item => <option key={item}>{item}</option>)}
          </select>
        </div>
        {loading ? <p className="muted text-sm">Loading providers…</p> : error ? <p className="muted text-sm">{error}</p> : visibleProviders.length ? <div className="divide-y divide-white/10">
          {visibleProviders.map((provider, index) => <article key={String(field(provider, 'id') || index)} className="grid gap-2 py-4 sm:grid-cols-2">
            <div><h3 className="font-semibold">{text(provider, 'name', 'provider_name')}</h3><p className="muted mt-1 text-sm">{text(provider, 'vehicle', 'vehicle_type')} · {text(provider, 'location', 'hub')}</p></div>
            <div className="sm:text-right"><p>{text(provider, 'from_hub', 'origin_hub', 'from_location', 'origin')} → {text(provider, 'to_hub', 'destination_hub', 'to_location', 'destination')}</p><p className="mt-1 text-sm gold">KES {text(provider, 'price_per_kg', 'price_kg')} / kg · {stars(field(provider, 'rating', 'average_rating'))}</p><p className="muted mt-1 text-xs">On-time {text(provider, 'on_time_rate')} · {text(provider, 'total_trips')} trips</p></div>
          </article>)}
        </div> : <p className="muted text-sm">No verified transport providers for this hub.</p>}
      </section>}

      {tab === 'Storage' && <section aria-label="Verified storage locations">
        <h2 className="mb-3 font-semibold">Verified storage locations</h2>
        {loading ? <p className="muted text-sm">Loading storage…</p> : error ? <p className="muted text-sm">{error}</p> : storage.length ? <div className="divide-y divide-white/10">
          {storage.map((place, index) => <article key={String(field(place, 'id') || index)} className="grid gap-2 py-4 sm:grid-cols-2">
            <div className="flex items-start gap-3"><Warehouse className="gold mt-1" size={18}/><div><h3 className="font-semibold">{text(place, 'name', 'location_name')}</h3><p className="muted mt-1 text-sm">{text(place, 'hub', 'location')}</p></div></div>
            <div className="sm:text-right"><span className="rounded bg-white/10 px-2 py-1 text-xs">{String(field(place, 'storage_type', 'type') || (field(place, 'is_cold', 'cold_storage') ? 'Cold' : 'Dry'))}</span><p className="mt-2 text-sm">{text(place, 'available_kg')} / {text(place, 'capacity_kg', 'capacity')} kg available</p><p className="mt-1 text-sm gold">KES {text(place, 'price_per_day', 'daily_price')} / day · {stars(field(place, 'rating', 'average_rating'))}</p></div>
          </article>)}
        </div> : <p className="muted text-sm">No verified storage locations available.</p>}
      </section>}

      {tab === 'Weather' && <section aria-label="Current weather">
        <div className="mb-3 flex items-center gap-2"><CloudSun className="gold" size={18}/><h2 className="font-semibold">Farm weather</h2></div>
        {loading ? <p className="muted text-sm">Loading weather…</p> : error || weather.length === 0 ? <p className="muted text-sm">Weather unavailable</p> : <div className="grid gap-x-6 sm:grid-cols-2">
          {weather.map(item => <article key={item.city} className="flex items-center justify-between gap-3 border-b border-white/10 py-3"><div><h3 className="font-medium">{item.city}</h3><p className="muted text-xs">{item.condition} · {item.humidity}% humidity · {item.precipitation} mm rain</p><p className="mt-1 text-xs gold">Best for: {item.bestFor}</p></div><p className="text-xl font-semibold">{item.temperature}°C</p></article>)}
        </div>}
      </section>}

      {tab === 'Daraja Escrow' && <section aria-label="Daraja escrow status">
        <h2 className="font-semibold">M-Pesa escrow</h2>
        <div className="my-4 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
          {['Buyer Pays (STK)', 'Held', 'Delivery Confirmed', 'Released'].map((step, index) => <div key={step} className="border border-white/10 p-3"><span className="gold">{index + 1}</span><p className="mt-1">{step}</p></div>)}
        </div>
        {!paymentEnabled && <p className="mb-4 border-l-2 border-amber-400 pl-3 text-sm text-amber-300">Escrow not enabled yet - do not send funds</p>}
        {loading ? <p className="muted text-sm">Loading escrow orders…</p> : error ? <p className="muted text-sm">{error}</p> : payments.length ? <div className="divide-y divide-white/10">{payments.map((payment, index) => <article key={String(field(payment, 'id') || index)} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><div><p>Order {String(field(payment, 'order_id')).slice(0, 8)} · {text(payment, 'status')}</p><p className="muted mt-1 text-xs">{new Date(String(field(payment, 'created_at'))).toLocaleString()}</p></div><p className="gold">KES {Number(field(payment, 'amount_kes') || 0).toLocaleString()}</p></article>)}</div> : <p className="muted text-sm">No escrow orders yet.</p>}
      </section>}

      {tab === 'Quality Check' && <section aria-label="Submit quality check">
        <h2 className="mb-3 font-semibold">Quality check</h2>
        {!userId ? <p className="muted text-sm">Sign in to submit a quality check.</p> : <form className="grid gap-3 sm:grid-cols-2" onSubmit={submitQualityCheck}>
          <label className="text-sm sm:col-span-2">Trade
            <select className="field mt-1" value={qualityTrade} onChange={event => setQualityTrade(event.target.value)} required><option value="">Select a paid trade</option>{trades.map((trade, index) => <option key={String(field(trade, 'trade_id') || index)} value={String(field(trade, 'trade_id'))}>{text(trade, 'category')} · {text(trade, 'variety')} · {String(field(trade, 'trade_id')).slice(0, 8)}</option>)}</select>
          </label>
          <label className="text-sm">Grade
            <select className="field mt-1" value={grade} onChange={event => setGrade(event.target.value)}>{['A', 'B', 'C', 'REJECT'].map(item => <option key={item}>{item}</option>)}</select>
          </label>
          <label className="text-sm">Quantity (kg)
            <input className="field mt-1" type="number" min="0.01" step="0.01" value={quantity} onChange={event => setQuantity(event.target.value)} required />
          </label>
          <label className="text-sm">Photo
            <input className="field mt-1" type="file" accept="image/*" capture="environment" onChange={event => setPhoto(event.target.files?.[0] || null)} required />
          </label>
          <div className="flex items-end"><button className="ghost-btn min-h-11 w-full" type="button" onClick={captureGps}>{gps ? `GPS ${gps.latitude.toFixed(4)}, ${gps.longitude.toFixed(4)}` : 'Capture GPS'}</button></div>
          <label className="text-sm sm:col-span-2">Notes
            <textarea className="field mt-1 min-h-20" value={notes} onChange={event => setNotes(event.target.value)} maxLength={1000} />
          </label>
          <div className="sm:col-span-2"><button className="gold-btn min-h-11" type="submit" disabled={loading}>{loading ? 'Submitting…' : 'Submit quality check'}</button></div>
        </form>}
        {error && tab === 'Quality Check' && <p className="mt-3 text-sm text-red-400" role="alert">{error}</p>}
        {message && tab === 'Quality Check' && <p className="mt-3 text-sm gold" role="status">{message}</p>}
      </section>}
      {error && tab !== 'Quality Check' && <p className="mt-3 text-sm text-red-400" role="alert">{error}</p>}
      <p className="muted flex items-center gap-2 border-t border-white/10 pt-3 text-xs"><BadgeCheck size={14} className="gold"/> Verified providers and quality checks are stored in Supabase.</p>
    </div>
  )
}
