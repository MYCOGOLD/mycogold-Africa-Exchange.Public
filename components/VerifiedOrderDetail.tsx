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
  delivered_at: string | null
  buyer_confirmed_at: string | null
  disputed_at: string | null
  escrow_released_at: string | null
  listing: { category: string | null; product: string | null; location: string | null } | null
}

export function VerifiedOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [viewerId, setViewerId] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [trust, setTrust] = useState('')
  const [disputeReason, setDisputeReason] = useState('')
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

  async function markDelivered() {
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(id)}/delivery`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not record delivery.')
      setMessage('Delivery recorded. The buyer can now confirm receipt.')
      await loadOrder()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not record delivery.')
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmDelivery() {
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(id)}/confirm`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not confirm delivery.')
      setMessage('Delivery confirmed. Escrow remains held during the 24-hour dispute window.')
      await loadOrder()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not confirm delivery.')
    } finally {
      setSubmitting(false)
    }
  }

  async function disputeOrder() {
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(id)}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: disputeReason }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not submit the dispute.')
      setMessage('Dispute recorded. Escrow remains held; no MFPI update or MCG reward will be issued.')
      await loadOrder()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit the dispute.')
    } finally {
      setSubmitting(false)
    }
  }

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
        body: JSON.stringify({ trust: trustValue }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not verify this trade.')
      setMessage(data.mfpiUpdated
        ? 'Delivery verified. MCG rewards recorded, MFPI recomputed, and escrow released.'
        : 'Delivery verified, but MFPI recompute or escrow release needs attention.')
      window.dispatchEvent(new Event('mcg:updated'))
      await loadOrder()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not verify this trade.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <main className="shell py-10 muted">Loading order…</main>
  if (error && !order) return <main className="shell py-10 text-red-400">{error}</main>
  if (!order) return <main className="shell py-10"><a className="gold" href="/orders">← Orders</a><p className="mt-6">Order not found</p></main>

  const isBuyer = viewerId === order.buyer_id
  const isSeller = viewerId === order.seller_id
  const disputeDeadline = order.buyer_confirmed_at ? new Date(order.buyer_confirmed_at).getTime() + 24 * 60 * 60 * 1000 : 0
  const disputeWindowOpen = disputeDeadline > Date.now()

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

        {isSeller && order.status === 'PAID_ESCROW' && !order.delivered_at && (
          <button className="gold-btn mt-5" type="button" disabled={submitting} onClick={markDelivered}>
            {submitting ? 'Saving…' : 'Mark Delivered'}
          </button>
        )}
        {isBuyer && order.status === 'PAID_ESCROW' && order.delivered_at && !order.buyer_confirmed_at && (
          <button className="gold-btn mt-5" type="button" disabled={submitting} onClick={confirmDelivery}>
            {submitting ? 'Saving…' : 'Confirm Delivery'}
          </button>
        )}
        {isBuyer && order.status === 'PAID_ESCROW' && order.buyer_confirmed_at && disputeWindowOpen && (
          <div className="mt-5 border-t border-white/10 pt-4">
            <label className="block text-sm">Dispute reason
              <textarea className="field mt-2 min-h-20" value={disputeReason} onChange={event => setDisputeReason(event.target.value)} maxLength={1000} />
            </label>
            <button className="ghost-btn mt-3" type="button" disabled={submitting || !disputeReason.trim()} onClick={disputeOrder}>Dispute within 24 hours</button>
          </div>
        )}
        {order.status === 'DISPUTED' && <p className="mt-5 border-t border-white/10 pt-4 text-sm text-amber-300">Disputed · Escrow remains held. No MFPI update or MCG reward is issued.</p>}
        {order.status === 'COMPLETED' && <p className="mt-5 border-t border-white/10 pt-4 text-sm gold">Delivery verified · Escrow released at {order.escrow_released_at ? new Date(order.escrow_released_at).toLocaleString() : '—'}.</p>}
        {isAdmin && order.status === 'PAID_ESCROW' && order.delivered_at && order.buyer_confirmed_at && !order.disputed_at && !disputeWindowOpen && !order.escrow_released_at && (
          <div className="mt-5 border-t border-white/10 pt-4">
            <label className="block text-sm">Trust score (0–1)
              <input className="field mt-2 max-w-xs" type="number" min="0" max="1" step="0.01" value={trust} onChange={event => setTrust(event.target.value)} required />
            </label>
            <button className="gold-btn mt-4" type="button" disabled={submitting} onClick={verifyTrade}>
              {submitting ? 'Verifying…' : 'Verify Delivery'}
            </button>
          </div>
        )}
        {message && <p className="mt-4 text-sm gold" role="status">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-400" role="alert">{error}</p>}
      </section>
    </main>
  )
}