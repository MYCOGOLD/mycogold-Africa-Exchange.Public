'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type OrderRecord = {
  id: string
  buyer_id: string
  seller_id: string
  quantity: number
  unit_price: number
  total_amount: number
  status: string
  listing: { category: string | null; product: string | null; location: string | null } | null
}

export function VerifiedOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [viewerId, setViewerId] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [trust, setTrust] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadOrder = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/orders/list?orderId=${encodeURIComponent(id)}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load this order.')
      setOrder(data.orders[0] || null)
      setViewerId(data.viewerId || '')
      setIsAdmin(data.isAdmin === true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load this order.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void loadOrder() }, [loadOrder])

  async function verifyTrade() {
    if (!order?.listing?.category) {
      setError('The order listing has no category and cannot be verified.')
      return
    }
    const trustValue = Number(trust)
    if (!Number.isFinite(trustValue) || trustValue < 0 || trustValue > 1) {
      setError('Enter a trust score between 0 and 1.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(id)}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: order.listing.category,
          variety: order.listing.product || order.listing.category,
          price: Number(order.unit_price),
          kg: Number(order.quantity),
          trust: trustValue,
          seller_id: order.seller_id,
          buyer_id: order.buyer_id,
          trade_id: order.id,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not verify this trade.')
      setMessage(data.mfpiUpdated
        ? 'Delivery verified. MCG rewards recorded and MFPI recomputed.'
        : 'Delivery verified and MCG rewards recorded. MFPI recompute needs attention.')
      window.dispatchEvent(new Event('mcg:updated'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not verify this trade.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <main className="shell py-10 muted">Loading order…</main>
  if (error && !order) return <main className="shell py-10 text-red-400">{error}</main>
  if (!order) return <main className="shell py-10"><a className="gold" href="/orders">← Orders</a><p className="mt-6">Order not found</p></main>

  return (
    <main className="shell min-h-screen py-8 sm:py-12">
      <a className="text-sm gold" href="/orders">← All orders</a>
      <header className="my-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono text-xs gold">ORDER {order.id}</p>
          <h1 className="mt-2 text-3xl font-semibold">{order.listing?.product || order.listing?.category || 'Produce order'}</h1>
        </div>
        <p className="text-sm muted">{order.status}</p>
      </header>

      <section className="glass max-w-2xl p-5">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4"><dt className="muted">Quantity</dt><dd>{Number(order.quantity).toLocaleString()} kg</dd></div>
          <div className="flex justify-between gap-4"><dt className="muted">Seller price</dt><dd>KES {Number(order.unit_price).toLocaleString()} / kg</dd></div>
          <div className="flex justify-between gap-4"><dt className="muted">Order total</dt><dd>KES {Number(order.total_amount).toLocaleString()}</dd></div>
          <div className="flex justify-between gap-4"><dt className="muted">Location</dt><dd>{order.listing?.location || '—'}</dd></div>
        </dl>

        {isAdmin && (
          <div className="mt-5 border-t border-white/10 pt-4">
            <label className="block text-sm">Trust score (0–1)
              <input className="field mt-2 max-w-xs" type="number" min="0" max="1" step="0.01" value={trust} onChange={event => setTrust(event.target.value)} required />
            </label>
            <button className="gold-btn mt-4" type="button" disabled={submitting} onClick={verifyTrade}>
              {submitting ? 'Verifying…' : 'Verify Delivery'}
            </button>
          </div>
        )}
        {!isAdmin && <p className="mt-5 border-t border-white/10 pt-4 text-sm muted">Delivery verification is restricted to an administrator.</p>}
        {message && <p className="mt-4 text-sm gold" role="status">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-400" role="alert">{error}</p>}
      </section>
    </main>
  )
}