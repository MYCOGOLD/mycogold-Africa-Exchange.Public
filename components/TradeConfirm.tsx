'use client'

import { ShieldCheck } from 'lucide-react'
import { validatePriceFloor } from '../lib/priceRules'

export function TradeConfirm({ price }: { listingId: string; price: number; kg: number; onConfirmed: (trade: { id: string; listingId: string; price: number; kg: number; confirmed_at: string }) => void }) {
  const floor = validatePriceFloor(price, 'KES')

  if (!floor.ok) {
    return (
      <div className="mt-4 rounded-xl border border-[#ff7777]/30 bg-[#ff7777]/10 p-3 text-sm text-[#ff7777]">
        This price does not meet the configured minimum.
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-xl border border-[#ffd60a]/20 bg-[#ffd60a]/5 p-3">
      <div className="flex items-center gap-2 text-xs gold">
        <ShieldCheck size={14} /> Trade confirmation temporarily unavailable
      </div>
      <p className="mt-2 text-xs muted">
        Secure buyer/seller verification and server-side order records are being implemented.
        No trade, wallet balance, or escrow payment is changed by this screen.
      </p>
    </div>
  )
}
