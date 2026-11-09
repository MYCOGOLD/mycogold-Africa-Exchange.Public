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

      const { data, error } = await supabase
        .from('orders')
        .insert({ listing_id: listingId, quantity: requested })
        .select('id,status,total_amount,unit_price,quantity')
        .single()

      if (error) throw error
      if (!data) throw new Error('The order request was not saved.')
      setMessage(
        `Order request ${String(data.id).slice(0, 8)} submitted. Seller response: ${data.status}. No payment has been taken.`,
      )
      setQuantity('1')
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
        {loading ? 'Submitting…' : 'Send order request'}
      </button>
      <p className="mt-2 text-[11px] muted">
        This sends a request to the seller only. It does not reserve payment, debit a wallet, or confirm a sale.
      </p>
      {message && <p className="mt-2 text-xs gold" role="status">{message}</p>}
    </div>
  )
}
