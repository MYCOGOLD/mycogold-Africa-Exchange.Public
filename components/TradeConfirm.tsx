'use client'

import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { createClient } from '../lib/supabase'

export function TradeConfirm({
  listingId,
  price,
  kg,
}: {
  listingId: string
  price: number
  kg: number
  onConfirmed?: (trade: { id: string; listingId: string; price: number; kg: number; confirmed_at: string }) => void
}) {
  const [quantity, setQuantity] = useState('1')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null)
  const [paymentPending, setPaymentPending] = useState(false)
  const available = Number(kg)
  const unitPrice = Number(price)
  const requested = Number(quantity)
  const valid = Number.isFinite(requested) && requested > 0 && requested <= available
  const total = valid && Number.isFinite(unitPrice) ? requested * unitPrice : 0

  async function requestOrder() {
    if (!valid) {
      setMessage('Enter a quantity greater than zero and no more than the available amount.')
      return
    }

    setLoading(true)
    setMessage('')
    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        setMessage('Sign in before requesting an order.')
        return
      }

      let orderId = pendingOrderId
      if (!orderId) {
        const { data, error } = await supabase
          .from('orders')
          .insert({ listing_id: listingId, quantity: requested })
          .select('id')
          .single()

        if (error) throw error
        if (!data) throw new Error('The order could not be created.')
        orderId = data.id
        setPendingOrderId(orderId)
      }
      if (!orderId) throw new Error('The order could not be created.')

      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/stk`, { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not start M-Pesa payment.')
      setPaymentPending(true)
      setMessage(`M-Pesa prompt sent for KES ${total.toLocaleString()}. Enter your PIN on your phone; funds remain in escrow until delivery is verified.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not submit the order request.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4 w-full rounded-xl border border-[#ffd60a]/20 bg-[#ffd60a]/5 p-3">
      <div className="flex items-center gap-2 text-xs gold">
        <ShoppingCart size={14} /> Request an order
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          className="field min-h-10 w-24"
          type="number"
          min="0.01"
          max={Number.isFinite(available) ? available : undefined}
          step="0.01"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          aria-label="Requested quantity in kilograms"
        />
        <span className="text-xs muted">kg · Max {available} kg</span>
        <span className="ml-auto text-xs gold">
          {Number.isFinite(total) ? `KES ${total.toLocaleString()}` : '—'}
        </span>
      </div>
      <button
        type="button"
        className="gold-btn mt-3 min-h-10 w-full"
        disabled={loading || !valid}
        onClick={requestOrder}
      >
        {loading ? 'Sending STK Push…' : paymentPending ? 'STK prompt sent' : pendingOrderId ? 'Retry M-Pesa prompt' : 'Buy with M-Pesa'}
      </button>
      <p className="mt-2 text-[11px] muted">
        M-Pesa charges the displayed price × quantity. Payment stays in escrow until delivery verification.
      </p>
      {message && <p className="mt-2 text-xs gold" role="status">{message}</p>}
    </div>
  )
}
