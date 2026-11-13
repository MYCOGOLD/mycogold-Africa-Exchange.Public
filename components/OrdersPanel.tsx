'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { createClient } from '../lib/supabase'

type Order = {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  quantity: number
  unit_price: number
  total_amount: number
  status: 'requested' | 'accepted' | 'rejected' | 'cancelled' | 'PAID_ESCROW' | 'DISPUTED' | 'COMPLETED'
  created_at: string
}

export function OrdersPanel({ userId }: { userId: string }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('orders')
        .select('id,listing_id,buyer_id,seller_id,quantity,unit_price,total_amount,status,created_at')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setOrders((data || []) as Order[])
      setMessage('')
    } catch {
      setOrders([])
      setMessage('Could not load your order requests. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, userId])

  async function changeStatus(orderId: string, status: 'accepted' | 'rejected' | 'cancelled') {
    setUpdatingId(orderId)
    setMessage('')
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .eq('status', 'requested')
        .select('id,status')
        .maybeSingle()

      if (error) throw error
      if (!data) throw new Error('The order may already have been updated.')
      await refresh()
      setMessage(`Order updated: ${data.status}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update this order.')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-3 p-4">
      <div className="rounded-xl border border-[#ffd60a]/20 bg-[#ffd60a]/5 p-3 text-xs muted">M-Pesa payments remain held in escrow until delivery confirmation, the dispute window, and admin verification are complete.</div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Order requests</h2>
        <button type="button" className="ghost-btn flex min-h-9 items-center gap-2 text-xs" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={13}/> Refresh
        </button>
      </div>
      {message && <p className="text-sm gold" role="status">{message}</p>}
      {loading ? (
        <p className="muted text-sm">Loading order requests…</p>
      ) : orders.length === 0 ? (
        <p className="muted text-sm">No order requests yet.</p>
      ) : orders.map((order) => {
        const isBuyer = order.buyer_id === userId
        const isSeller = order.seller_id === userId
        return (
          <article className="rounded-xl bg-white/[.04] p-4" key={order.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">Order {order.id.slice(0, 8)}</span>
              <span className="rounded-full bg-white/[.06] px-2 py-1 text-xs gold">{order.status}</span>
            </div>
            <p className="mt-2 text-sm">{isBuyer ? 'You requested' : isSeller ? 'Buyer requested' : 'Order'} {order.quantity} kg</p>
            <p className="muted mt-1 text-xs">
              KES {Number(order.unit_price).toLocaleString()} / kg · Total KES {Number(order.total_amount).toLocaleString()}
            </p>
            <p className="muted mt-1 text-xs">{new Date(order.created_at).toLocaleString()}</p>
            {order.status === 'requested' && (
              <div className="mt-3 flex flex-wrap gap-2">
                {isSeller && <>
                  <button className="gold-btn min-h-10" disabled={updatingId === order.id} onClick={() => changeStatus(order.id, 'accepted')}>Accept request</button>
                  <button className="ghost-btn min-h-10" disabled={updatingId === order.id} onClick={() => changeStatus(order.id, 'rejected')}>Decline</button>
                </>}
                {isBuyer && <button className="ghost-btn min-h-10" disabled={updatingId === order.id} onClick={() => changeStatus(order.id, 'cancelled')}>Cancel request</button>}
              </div>
            )}
            {order.status === 'accepted' && (
              <p className="mt-3 text-xs muted">Seller accepted. The buyer can complete payment from the listing order action.</p>
            )}
            {['PAID_ESCROW', 'DISPUTED', 'COMPLETED'].includes(order.status) && (
              <a className="ghost-btn mt-3 inline-flex min-h-10 items-center" href={`/orders/${encodeURIComponent(order.id)}`}>Manage delivery</a>
            )}
          </article>
        )
      })}
    </div>
  )
}
