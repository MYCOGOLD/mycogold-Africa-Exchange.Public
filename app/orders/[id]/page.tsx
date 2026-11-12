'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { MycgLiveScan } from '../../../components/MycgLiveScan'
import type { Order } from '../../../lib/mycg/mycogoldOrders'

const buyerId = 'demo-buyer'
type ListedOrder = Order & { label: 'FRESH' | 'OK' | 'LOW'; ageHours: number }

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<ListedOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [idNumber, setIdNumber] = useState('')
  const [selfiePhoto, setSelfiePhoto] = useState('')
  const [kycStatus, setKycStatus] = useState('NOT SUBMITTED')
  const [quantity, setQuantity] = useState(0)
  const [transportFee, setTransportFee] = useState('0')
  const [invoiceMessage, setInvoiceMessage] = useState('')
  const [invoiceTotal, setInvoiceTotal] = useState<number | null>(null)
  const [comments, setComments] = useState('')
  const [commentsScore, setCommentsScore] = useState('5')
  const [deliveryHours, setDeliveryHours] = useState('0')
  const [confirmation, setConfirmation] = useState('')
  const [confirmedAt, setConfirmedAt] = useState('')
  const [disputeStatus, setDisputeStatus] = useState('')
  const [scanResult, setScanResult] = useState<'PASSED' | 'FAILED' | ''>('')
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetch('/api/orders/list?status=ACTIVE')
      .then(response => response.json())
      .then(data => {
        if (!active) return
        const found = (data.orders as ListedOrder[]).find(item => item.id === id) || null
        setOrder(found)
        if (found) setQuantity(found.quantity)
      })
      .catch(() => { if (active) setError('Could not load this order.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  const productTotal = order ? order.price * quantity : 0
  const fees = productTotal * 0.05
  const total = productTotal + fees + Number(transportFee || 0)

  async function submitKyc() {
    const response = await fetch('/api/kyc', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: buyerId, idNumber, selfiePhoto }),
    })
    const data = await response.json()
    setKycStatus(data.status || data.error)
  }

  async function getInvoice() {
    const response = await fetch(`/api/orders/${encodeURIComponent(id)}/invoice`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: id, buyerId, quantity, transportFee: Number(transportFee || 0) }),
    })
    const data = await response.json()
    if (!response.ok) { setInvoiceMessage(data.error || 'Could not create invoice.'); return }
    setInvoiceTotal(data.invoice.total)
    setInvoiceMessage(`${data.escrow} · STK Push STUB - DORMANT, no real M-Pesa`)
  }

  async function confirmGood() {
    const timestamp = new Date().toISOString()
    setConfirmedAt(timestamp)
    const response = await fetch(`/api/orders/${encodeURIComponent(id)}/confirm`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: id, buyerVideo: null, buyerPhotos: [], lat: location?.lat ?? null, lng: location?.lng ?? null, comments, commentsScore: Number(commentsScore), deliveryHours: Number(deliveryHours) }),
    })
    setConfirmation(JSON.stringify(await response.json()))
  }

  async function reportBad() {
    const response = await fetch(`/api/orders/${encodeURIComponent(id)}/dispute`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: id, buyerId, comments, adminNote: '' }),
    })
    const data = await response.json()
    setDisputeStatus(`${data.status} · adminOversight ${String(data.adminOversight)}`)
  }

  if (loading) return <main className="shell py-10 muted">Loading order…</main>
  if (error) return <main className="shell py-10 text-red-400">{error}</main>
  if (!order) return <main className="shell py-10"><a className="gold" href="/orders">← Orders</a><p className="mt-6">Order not found</p></main>

  return (
    <main className="shell min-h-screen py-8 sm:py-12">
      <a className="text-sm gold" href="/orders">← All orders</a>
      <header className="my-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono text-xs gold">ORDER {order.id}</p>
          <h1 className="mt-2 text-3xl font-semibold">{order.product}</h1>
        </div>
        <p className="text-sm muted">Freshness <strong className="text-white">{order.freshness}% · {order.label}</strong></p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass p-5">
          <h2 className="text-lg font-semibold">Invoice preview</h2>
          <p className="mt-4 text-sm">Unit price <span className="float-right">KES {order.price.toLocaleString()}</span></p>
          <label className="mt-3 block text-sm">Quantity
            <input className="field mt-2" type="number" min="1" max={order.quantity} value={quantity} onChange={event => setQuantity(Number(event.target.value))} />
          </label>
          <label className="mt-3 block text-sm">Transport fee (KES)
            <input className="field mt-2" type="number" min="0" value={transportFee} onChange={event => setTransportFee(event.target.value)} />
          </label>
          <dl className="mt-5 space-y-2 border-t border-white/10 pt-4 text-sm">
            <div className="flex justify-between"><dt>Product total</dt><dd>KES {productTotal.toLocaleString()}</dd></div>
            <div className="flex justify-between"><dt>Fees (5%)</dt><dd>KES {fees.toLocaleString()}</dd></div>
            <div className="flex justify-between"><dt>Transport</dt><dd>KES {Number(transportFee || 0).toLocaleString()}</dd></div>
            <div className="flex justify-between font-semibold gold"><dt>Total</dt><dd>KES {total.toLocaleString()}</dd></div>
          </dl>
        </section>

        <section className="glass p-5">
          <h2 className="text-lg font-semibold">1 · KYC</h2>
          <label className="mt-4 block text-sm">ID number
            <input className="field mt-2" value={idNumber} onChange={event => setIdNumber(event.target.value)} />
          </label>
          <label className="mt-3 block text-sm">Selfie photo URL
            <input className="field mt-2" type="url" value={selfiePhoto} onChange={event => setSelfiePhoto(event.target.value)} />
          </label>
          <button className="gold-btn mt-4" type="button" onClick={submitKyc}>Submit KYC</button>
          <span className="ml-3 text-sm gold" role="status">{kycStatus}</span>
          <p className="mt-3 text-xs muted">Demo-only in-memory verification; no KYC provider is called.</p>
        </section>

        <section className="glass p-5">
          <h2 className="text-lg font-semibold">2 · Match / Buy</h2>
          <p className="mt-2 text-sm muted">Create a preview invoice after KYC verification.</p>
          <button className="gold-btn mt-4" type="button" onClick={getInvoice}>Get Invoice</button>
          {invoiceMessage && <p className="mt-3 text-sm gold" role="status">{invoiceMessage}</p>}
          {invoiceTotal !== null && <p className="mt-2 text-sm">Invoice total: KES {invoiceTotal.toLocaleString()}</p>}
        </section>

        <section className="glass p-5">
          <h2 className="text-lg font-semibold">3 · Live Scan</h2>
          <div className="mt-4">
            <MycgLiveScan expectedQuantity={order.quantity} onLocationChange={setLocation} onScanComplete={passed => setScanResult(passed ? 'PASSED' : 'FAILED')} />
          </div>
          {scanResult && <p className={`mt-3 text-sm font-semibold ${scanResult === 'PASSED' ? 'text-green-400' : 'text-red-400'}`}>Scan {scanResult}</p>}
        </section>

        <section className="glass p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold">4 · Buyer Confirm</h2>
          <label className="mt-4 block text-sm">Comments
            <textarea className="field mt-2 min-h-24" value={comments} onChange={event => setComments(event.target.value)} />
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Comment score
              <select className="field mt-2" value={commentsScore} onChange={event => setCommentsScore(event.target.value)}>{[1, 2, 3, 4, 5].map(score => <option key={score} value={score}>{score}</option>)}</select>
            </label>
            <label className="text-sm">Delivery hours
              <input className="field mt-2" type="number" min="0" value={deliveryHours} onChange={event => setDeliveryHours(event.target.value)} />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="gold-btn" type="button" onClick={confirmGood}>Confirm Good</button>
            <button className="ghost-btn" type="button" onClick={reportBad}>Report Bad / Dispute</button>
          </div>
          {confirmedAt && <p className="mt-3 text-xs muted">Confirmation submitted: {confirmedAt}</p>}
          {confirmation && <p className="mt-2 text-sm gold" role="status">{confirmation}</p>}
          {disputeStatus && <p className="mt-2 text-sm gold" role="status">{disputeStatus}</p>}
          <p className="mt-3 text-xs muted">Confirm submits no media unless captured; missing buyer proof leaves escrow in reconciliation. No real payment is initiated.</p>
        </section>
      </div>
    </main>
  )
}