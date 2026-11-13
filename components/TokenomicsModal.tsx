'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '../lib/supabase'

type Tokenomics = {
  total_supply: number
  minted: number
  remaining: number
  holders: number
  total_awards: number
}

const rules = [
  ['Daily award limit', 'Max 50 MCG/day'],
  ['Delivery', '5 MCG'],
  ['Quality', '2 MCG'],
  ['Confirmation', '1 MCG'],
  ['Future delivery discount', '10 MCG = 100 KES'],
]

function amount(value: number | undefined) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function TokenomicsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [data, setData] = useState<Tokenomics | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    async function load() {
      try {
        const { data: row, error: queryError } = await createClient().from('mcg_tokenomics')
          .select('total_supply,minted,remaining,holders,total_awards')
          .maybeSingle()
        if (!active) return
        if (queryError || !row) setError('Tokenomics data is unavailable.')
        else setData(row as Tokenomics)
      } catch {
        if (active) setError('Tokenomics data is unavailable.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/80 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="glass w-full max-w-lg p-5" role="dialog" aria-modal="true" aria-labelledby="tokenomics-title">
        <header className="flex items-start justify-between gap-4">
          <div><p className="mono text-xs gold">MCG</p><h2 id="tokenomics-title" className="mt-1 text-xl font-bold">Tokenomics</h2></div>
          <button type="button" className="ghost-btn p-2" onClick={onClose} aria-label="Close tokenomics"><X size={18}/></button>
        </header>
        {loading ? <p className="muted mt-5 text-sm">Loading tokenomics…</p> : error ? <p className="mt-5 text-sm text-red-400">{error}</p> : data && <>
          <dl className="mt-5 grid grid-cols-2 gap-3">
            {[
              ['Total Supply', data.total_supply],
              ['Minted', data.minted],
              ['Remaining', data.remaining],
              ['Holders', data.holders],
              ['Total Awards', data.total_awards],
            ].map(([label, value]) => <div className="border-l border-white/15 pl-3" key={String(label)}><dt className="muted text-xs">{label}</dt><dd className="mt-1 font-semibold gold">{amount(Number(value))}</dd></div>)}
          </dl>
          <div className="mt-5 border-t border-white/10 pt-4"><h3 className="text-sm font-semibold">Award rules</h3><dl className="mt-2 space-y-2 text-sm">{rules.map(([label, value]) => <div className="flex justify-between gap-4" key={label}><dt className="muted">{label}</dt><dd>{value}</dd></div>)}</dl></div>
          <p className="mt-5 border-t border-white/10 pt-4 text-xs muted">Every MCG entry is SHA-256 hash-chained.</p>
        </>}
      </section>
    </div>
  )
}