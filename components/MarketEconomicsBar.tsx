'use client'

import { useEffect, useState } from 'react'
import { Coins } from 'lucide-react'
import { createClient } from '../lib/supabase'

type MfpiStatus = 'UNPUBLISHED' | 'PUBLISHED' | 'STALE'
type MfpiRow = { trade_date: string; mfpi_value: number; status: MfpiStatus; total_verified_trades: number }
type MfpiState = { kind: 'loading' } | { kind: 'unavailable' } | { kind: 'ready'; row: MfpiRow | null }

// Only consume an explicitly published global index row. The current database calculator emits
// per-category weighted prices; do not present those as a global MFPI or as an index.
const GLOBAL_MFPI_CATEGORY = 'ALL'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function nairobiTradeDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

function parseMfpiRow(data: unknown): MfpiRow | null {
  if (!Array.isArray(data) || data.length === 0) return null
  const item: unknown = data[0]
  if (!isRecord(item)) return null
  const { trade_date, mfpi_value, status, total_verified_trades } = item
  if (typeof trade_date !== 'string') return null
  if (status !== 'UNPUBLISHED' && status !== 'PUBLISHED' && status !== 'STALE') return null
  if (typeof total_verified_trades !== 'number') return null
  const index = Number(mfpi_value)
  if (mfpi_value === null || mfpi_value === undefined || !Number.isFinite(index)) return null
  return { trade_date, mfpi_value: index, status, total_verified_trades }
}

export function MarketEconomicsBar() {
  const [mfpi, setMfpi] = useState<MfpiState>({ kind: 'loading' })
  const [userId, setUserId] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    let cleanup: () => void = () => {}

    try {
      const supabase = createClient()

      async function refresh(sessionUserId?: string | null) {
        const tradeDate = nairobiTradeDate(new Date())
        const [userIdResult, mfpiResult] = await Promise.all([
          sessionUserId === undefined ? supabase.auth.getUser().then(({ data }) => data.user?.id || null) : Promise.resolve(sessionUserId),
          supabase.from('mfpi_daily')
            .select('trade_date,mfpi_value,status,total_verified_trades')
            .eq('category', GLOBAL_MFPI_CATEGORY)
            .eq('trade_date', tradeDate)
            .order('computed_at', { ascending: false })
            .limit(1),
        ])
        if (!active) return

        setUserId(userIdResult)
        setMfpi(mfpiResult.error ? { kind: 'unavailable' } : { kind: 'ready', row: parseMfpiRow(mfpiResult.data) })
        if (!userIdResult) {
          setBalance(null)
          return
        }

        const { data: balanceData, error: balanceError } = await supabase
          .from('mcg_balances')
          .select('balance')
          .eq('user_id', userIdResult)
          .maybeSingle()
        if (active) setBalance(balanceError ? null : Number(balanceData?.balance ?? 0))
      }

      void refresh()
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => { void refresh(session?.user.id || null) })
      const handleRefresh = () => { void refresh() }
      window.addEventListener('focus', handleRefresh)
      window.addEventListener('mcg:updated', handleRefresh)
      cleanup = () => {
        authListener.subscription.unsubscribe()
        window.removeEventListener('focus', handleRefresh)
        window.removeEventListener('mcg:updated', handleRefresh)
      }
    } catch {
      setMfpi({ kind: 'unavailable' })
    }

    return () => {
      active = false
      cleanup()
    }
  }, [])

  const row = mfpi.kind === 'ready' ? mfpi.row : null
  const statusText =
    mfpi.kind === 'loading' ? 'MFPI - loading'
    : mfpi.kind === 'unavailable' ? 'MFPI - UNAVAILABLE (could not load the index)'
    : row && row.status === 'PUBLISHED'
      ? `MFPI - PUBLISHED · index ${row.mfpi_value.toLocaleString(undefined, { maximumFractionDigits: 5 })} · based on ${row.total_verified_trades} verified trades`
      : row && row.status === 'STALE' ? 'MFPI - STALE · waiting for new verified trades'
      : row && row.status === 'UNPUBLISHED' ? 'MFPI - UNPUBLISHED'
      : 'MFPI - GLOBAL INDEX UNAVAILABLE'

  return (
    <section className="border-b border-white/10 bg-black/90" aria-label="Verified market index and MCG balance">
      <div className="shell flex min-h-12 flex-wrap items-center justify-between gap-3 py-2">
        <p className="text-xs font-semibold tracking-wide" role="status">{statusText}</p>
        <a className="inline-flex min-h-9 items-center gap-2 rounded-md border border-white/15 px-3 text-sm hover:border-[#ffd60a]/60" href="/mcg-history">
          <Coins size={16} className="gold" aria-hidden="true" />
          {userId ? `${balance === null ? '—' : balance.toLocaleString()} MCG` : 'Sign in for MCG'}
        </a>
      </div>
    </section>
  )
}

