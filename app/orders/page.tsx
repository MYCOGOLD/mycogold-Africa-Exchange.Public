'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Status = 'ACTIVE' | 'PAST'
type ListedOrder = {
  id: string
  quantity: number
  unit_price: number
  status: string
  listing: { category: string | null; product: string | null; location: string | null } | null
}
type PostLocation = { lat: number; lng: number; accuracy: number; capturedAt: string }

export default function OrdersPage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('ACTIVE')
  const [orders, setOrders] = useState<ListedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [postLocation, setPostLocation] = useState<PostLocation | null>(null)
  const [capturingLocation, setCapturingLocation] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    fetch(`/api/orders/list?status=${status}`)
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not load orders.')
        return data.orders as ListedOrder[]
      })
      .then(data => { if (active) setOrders(data) })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load orders.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [status])

  function capturePostLocation() {
    setPostLocation(null)
    if (!navigator.geolocation) {
      window.alert('You must allow location to post a real listing')
      return
    }
    setCapturingLocation(true)
    navigator.geolocation.getCurrentPosition(
      position => {
        setPostLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date().toISOString(),
        })
        setNotice('Requires KYC + 2 photos + 1 video + Live Camera')
        setCapturingLocation(false)
      },
      () => {
        setCapturingLocation(false)
        setNotice('')
        window.alert('You must allow location to post a real listing')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <main className="shell min-h-screen py-8 sm:py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono text-xs gold">MYCOGOLD AFRICA EXCHANGE</p>
          <h1 className="mt-2 text-3xl font-semibold">Produce orders</h1>
        </div>
        <button className="gold-btn" type="button" disabled={capturingLocation} onClick={capturePostLocation}>
          {capturingLocation ? 'Capturing location…' : 'Post Order'}
        </button>
      </header>

      {postLocation && (
        <section className="glass mb-6 p-4" role="status">
          <p className="text-sm gold">
            Location captured: {postLocation.lat.toFixed(5)}, {postLocation.lng.toFixed(5)} - {new Date(postLocation.capturedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - GPS accurate to {Math.round(postLocation.accuracy)}m
          </p>
          <p className="mt-2 text-xs muted">Location is held in this post draft and is not submitted until a listing form is available.</p>
        </section>
      )}
      <div className="mb-6 flex gap-2" role="tablist" aria-label="Order status">
        {(['ACTIVE', 'PAST'] as const).map(tab => (
          <button key={tab} role="tab" aria-selected={status === tab} className={status === tab ? 'gold-btn' : 'ghost-btn'} onClick={() => setStatus(tab)}>
            {tab}
          </button>
        ))}
      </div>
      {notice && <p className="mb-5 text-sm gold" role="status">{notice}</p>}
      {loading && <p className="muted">Loading orders…</p>}
      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      {!loading && !error && orders.length === 0 && <p className="muted">No {status.toLowerCase()} orders.</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {orders.map(order => (
          <article className="glass p-5" key={order.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{order.listing?.product || order.listing?.category || 'Produce order'}</h2>
                <p className="mt-1 text-sm muted">{order.quantity.toLocaleString()} kg · KES {Number(order.unit_price).toLocaleString()} / kg</p>
              </div>
              <span className="mono text-xs gold">{order.status}</span>
            </div>
            <p className="mt-3 text-sm muted">{order.listing?.location || 'Location unavailable'}</p>
            <button type="button" className="gold-btn mt-5 w-full" onClick={() => router.push(`/orders/${encodeURIComponent(order.id)}`)}>
              View order
            </button>
          </article>
        ))}
      </div>
    </main>
  )
}