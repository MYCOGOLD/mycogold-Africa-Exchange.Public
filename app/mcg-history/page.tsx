'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'

type LedgerEntry = {
  id: string
  amount: number
  reason: string
  trade_id: string
  entry_hash: string
  created_at: string
}

export default function McgHistoryPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [signedIn, setSignedIn] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      const supabase = createClient()
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (!active) return
      if (authError || !authData.user) {
        setSignedIn(false)
        setLoading(false)
        return
      }
      setSignedIn(true)
      const { data, error: ledgerError } = await supabase
        .from('mcg_ledger')
        .select('id,amount,reason,trade_id,entry_hash,created_at')
        .eq('user_id', authData.user.id)
        .order('created_at', { ascending: false })
        .limit(100)
      if (!active) return
      if (ledgerError) setError('Could not load MCG history.')
      setEntries((data || []) as LedgerEntry[])
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [])

  return (
    <main className="shell min-h-screen py-8 sm:py-12">
      <a className="text-sm gold" href="/">← Marketplace</a>
      <header className="my-6 flex items-end justify-between gap-4">
        <div>
          <p className="mono text-xs gold">MCG LEDGER</p>
          <h1 className="mt-2 text-3xl font-semibold">Reward history</h1>
        </div>
        <p className="muted text-sm">Most recent 100 entries</p>
      </header>
      {!signedIn && !loading && <p className="muted">Sign in to view your MCG history.</p>}
      {loading && <p className="muted">Loading history…</p>}
      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      {!loading && signedIn && !error && entries.length === 0 && <p className="muted">No MCG ledger entries yet.</p>}
      {entries.length > 0 && (
        <div className="overflow-x-auto border-y border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="muted border-b border-white/10 text-xs uppercase">
              <tr><th className="py-3 pr-4">Date</th><th className="py-3 pr-4">Reason</th><th className="py-3 pr-4">Trade</th><th className="py-3 pr-4">Amount</th><th className="py-3">SHA-256</th></tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr className="border-b border-white/5" key={entry.id}>
                  <td className="py-3 pr-4">{new Date(entry.created_at).toLocaleString()}</td>
                  <td className="py-3 pr-4">{entry.reason}</td>
                  <td className="py-3 pr-4 font-mono text-xs">{entry.trade_id.slice(0, 8)}</td>
                  <td className="py-3 pr-4 gold">+{Number(entry.amount).toLocaleString()} MCG</td>
                  <td className="py-3 font-mono text-xs muted" title={entry.entry_hash}>{entry.entry_hash.slice(0, 16)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}