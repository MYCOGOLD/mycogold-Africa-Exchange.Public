'use client'

import { useEffect, useState } from 'react'
import { Coins } from 'lucide-react'
import { createClient } from '../lib/supabase'

const categories = ['Mushroom', 'Potatoes', 'Onions', 'Kales', 'Cabbage', 'Cereals', 'Beef', 'Tomato', 'Carrot', 'Spinach']

type MfpiRow = {
  category: string
  trade_date: string
  mfpi_value: number | null
  status: 'UNPUBLISHED' | 'PUBLISHED' | 'STALE'
  total_verified_trades: number
}

export function MarketEconomicsBar() {
  const [rows, setRows] = useState<MfpiRow[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    const supabase = createClient()

    async function refresh(sessionUserId?: string | null) {
      const [userIdResult, { data: mfpiData }] = await Promise.all([
        sessionUserId === undefined ? supabase.auth.getUser().then(({ data }) => data.user?.id || null) : Promise.resolve(sessionUserId),
        supabase.from('mfpi_daily')
          .select('category,trade_date,mfpi_value,status,total_verified_trades')
          .eq('trade_date', new Date().toISOString().slice(0, 10))
          .order('computed_at', { ascending: false })
          .limit(100),
      ])
      if (!active) return

      setUserId(userIdResult)
      setRows((mfpiData || []) as MfpiRow[])
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
    return () => {
      active = false
      authListener.subscription.unsubscribe()
      window.removeEventListener('focus', handleRefresh)
      window.removeEventListener('mcg:updated', handleRefresh)
    }
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const latestByCategory = new Map<string, MfpiRow>()
  for (const row of rows) {
    if (!latestByCategory.has(row.category)) latestByCategory.set(row.category, row)
  }
  const publishedCount = [...latestByCategory.values()].filter(row => row.trade_date === today && row.status === 'PUBLISHED').length

  return (
    <section className="border-b border-white/10 bg-black/90" aria-label="Verified market index and MCG balance">
      <div className="shell flex min-h-12 flex-wrap items-center justify-between gap-3 py-2">
        <p className="text-xs font-semibold tracking-wide" role="status">
          {publishedCount ? `MFPI - PUBLISHED · ${publishedCount} categories` : 'MFPI - UNPUBLISHED No verified trades yet'}
        </p>
        <a className="inline-flex min-h-9 items-center gap-2 rounded-md border border-white/15 px-3 text-sm hover:border-[#ffd60a]/60" href="/mcg-history">
          <Coins size={16} className="gold" aria-hidden="true" />
          {userId ? `${balance === null ? '—' : balance.toLocaleString()} MCG` : 'Sign in for MCG'}
        </a>
      </div>
      <div className="shell grid grid-cols-2 gap-x-4 gap-y-2 pb-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Daily MFPI by category">
        {categories.map(category => {
          const row = latestByCategory.get(category)
          const current = row?.trade_date === today && row.status === 'PUBLISHED' && row.mfpi_value !== null
          const label = current
            ? `KES ${Number(row.mfpi_value).toLocaleString(undefined, { maximumFractionDigits: 2 })}/kg · based on ${row.total_verified_trades} verified trades`
            : row?.status === 'STALE'
              ? 'Stale'
              : 'Not enough verified trades yet'
          return (
            <div className="min-w-0 border-l border-white/10 pl-2" key={category}>
              <p className="text-[10px] uppercase text-white/55">{category}</p>
              <p className="truncate text-xs" title={label}>{label}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}