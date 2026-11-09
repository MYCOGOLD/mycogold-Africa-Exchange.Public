'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type Order = {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  quantity: number
  unit_price: number
  total_amount: number
  status: 'requested' | 'accepted' | 'rejected' | 'cancelled'
  created_at: string
}

export function OrdersPanel({ userId }: { userId: string }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('orders')
      .select('id,listing_id,buyer_id,seller_id,quantity,unit_price,total_amount,status,created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      setOrders([])
      setMessage('Could not load your order requests.')
    } else {
      setOrders((data || []) as Order[])
      setMessage('')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, userId])

  async function changeStatus(orderId: string, status: 'accepted' | 'rejected' | 'cancelled') {
    setMessage('Updating order…')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .eq('status', 'requested')
      .select('id,status')
      .maybeSingle()

    if (error || !data) {
      setMessage(error?.message || 'Order could not be changed. It may already have been updated.')
      return
    }
    await refresh()
    setMessage(`Order updated: ${data.status}.`)
  }

  if (loading) return <p className="muted p-4 text-sm">Loading order requests…</p>

  return (
    <div className="space-y-3 p-4">
      {message && <p className="text-sm gold" role="status">{message}</p>}
      {orders.length === 0 ? (
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
                  <button className="gold-btn min-h-10" onClick={() => changeStatus(order.id, 'accepted')}>Accept request</button>
                  <button className="ghost-btn min-h-10" onClick={() => changeStatus(order.id, 'rejected')}>Decline</button>
                </>}
                {isBuyer && <button className="ghost-btn min-h-10" onClick={() => changeStatus(order.id, 'cancelled')}>Cancel request</button>}
              </div>
            )}
            {order.status === 'accepted' && (
              <p className="mt-3 text-xs muted">Seller accepted the request. No payment has been taken and no sale is settled.</p>
            )}
          </article>
        )
      })}
    </div>
  )
}
