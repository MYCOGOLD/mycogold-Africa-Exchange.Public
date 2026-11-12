'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Order } from '../../lib/mycg/mycogoldOrders'

type Status = 'ACTIVE' | 'PAST'
type ListedOrder = Order & { label: 'FRESH' | 'OK' | 'LOW'; ageHours: number }

export default function OrdersPage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('ACTIVE')
  const [orders, setOrders] = useState<ListedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

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

  return (
    <main className="shell min-h-screen py-8 sm:py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono text-xs gold">MYCOGOLD AFRICA EXCHANGE</p>
          <h1 className="mt-2 text-3xl font-semibold">Produce orders</h1>
        </div>
        <button className="gold-btn" type="button" onClick={() => setNotice('Requires KYC + 2 photos + 1 video + Live Camera')}>
          Post Order
        </button>
      </header>

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
                <h2 className="text-xl font-semibold">{order.product}</h2>
                <p className="mt-1 text-sm muted">{order.quantity.toLocaleString()} units · KES {order.price.toLocaleString()} / unit</p>
              </div>
              <span className="mono text-xs gold">{order.status}</span>
            </div>
            <p className="mt-5 text-sm">Freshness: <strong>{order.freshness}%</strong> <span className="gold">{order.label}</span></p>
            <p className="mt-1 text-xs muted">Updated {order.ageHours}h ago</p>
            <button type="button" className="gold-btn mt-5 w-full" onClick={() => router.push(`/orders/${encodeURIComponent(order.id)}`)}>
              Match / Buy
            </button>
          </article>
        ))}
      </div>
    </main>
  )
}