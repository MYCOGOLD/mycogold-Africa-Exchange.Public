'use client'

import { useEffect, useState } from 'react'
import { Coins, Eye, EyeOff, LogOut, WalletCards } from 'lucide-react'
import { createClient } from '../lib/supabase'
import { firstName, maskPhone } from '../lib/normalizePhone'
import type { Listing, Profile, Trade } from '../lib/supabase'
import { OrdersPanel } from './OrdersPanel'
import { StaffPanel } from './staff-panel'
import { TokenomicsModal } from './TokenomicsModal'

type ProfileTab = 'My Listings' | 'My Trades' | 'My Orders' | 'Settings'

export function ProfileLoggedIn({ userId, isStaff, onSignOut }: { userId: string; isStaff: boolean; onSignOut: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [mcgBalance, setMcgBalance] = useState(0)
  const [tab, setTab] = useState<ProfileTab>('My Listings')
  const [showPassword, setShowPassword] = useState(false)
  const [tokenomicsOpen, setTokenomicsOpen] = useState(false)
  const [message, setMessage] = useState('Loading profile…')

  useEffect(() => {
    let active = true
    async function loadProfile() {
      try {
        const supabase = createClient()
        let { data: row } = await supabase.from('profiles')
          .select('id,phone,name,balance,created_at')
          .eq('id', userId)
          .maybeSingle()

        if (!row) {
          const { data: { user } } = await supabase.auth.getUser()
          const pendingValue = localStorage.getItem('mycogold-pending-profile')
          let pending: Record<string, unknown> = {}
          try {
            const parsed: unknown = pendingValue ? JSON.parse(pendingValue) : {}
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) pending = parsed as Record<string, unknown>
          } catch {
            pending = {}
          }
          const phoneValue = String(pending.phone || user?.user_metadata?.phone || user?.email?.split('@')[0] || '')
          const nameValue = String(pending.name || user?.user_metadata?.name || user?.user_metadata?.full_name || 'Trader')
          const rebuilt = { id: userId, phone: phoneValue.startsWith('254') ? `+${phoneValue}` : phoneValue, name: nameValue }
          const { error: profileError } = await supabase.from('profiles').upsert(rebuilt)
          if (profileError) throw profileError
          row = { ...rebuilt, balance: 0, created_at: undefined }
          if (pendingValue) localStorage.removeItem('mycogold-pending-profile')
        }
        if (!active) return
        setProfile(row as Profile)

        const [listingResult, tradeResult, balanceResult] = await Promise.all([
          supabase.from('listings').select('*').eq('seller_id', userId).order('created_at', { ascending: false }),
          supabase.from('trades').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
          supabase.from('mcg_balances').select('balance').eq('user_id', userId).maybeSingle(),
        ])
        if (!active) return
        setListings((listingResult.data || []) as Listing[])
        setTrades((tradeResult.data || []) as Trade[])
        setMcgBalance(balanceResult.error ? 0 : Number(balanceResult.data?.balance ?? 0))
        setMessage('')
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'Could not load profile. Please refresh.')
      }
    }
    void loadProfile()
    return () => { active = false }
  }, [userId])

  async function sendPasswordReset() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const email = user?.email || ''
    if (!email || email.endsWith('@mycogold.africa')) {
      setMessage('This legacy phone-only account has no verified recovery email. Contact MycoGold support.')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback` })
    setMessage(error ? 'Could not send the recovery email. Try again later.' : 'Password reset email sent.')
  }

  if (!profile) {
    return <section className="shell max-w-md p-3 md:max-w-6xl md:p-4"><div className="glass p-6 muted">{message || 'Loading profile…'}</div></section>
  }

  const formatKES = (value: number | null | undefined) => `KES ${(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const tabs: ProfileTab[] = ['My Listings', 'My Trades', 'My Orders', 'Settings']

  return (
    <section className="shell max-w-md space-y-4 p-3 md:max-w-6xl md:p-4">
      <div className="glass p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-[#ffd60a] text-xl font-bold text-black">{firstName(profile.name || 'T').slice(0, 1).toUpperCase()}</div>
            <div>
              <h1 className="text-2xl font-bold">{profile.name || 'Trader'}</h1>
              <p className="muted">{maskPhone(profile.phone)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-[#ffd60a]/10 px-2 py-1 text-xs gold">Farmer / Trader</span>
                <span className="rounded-full bg-[#68ff91]/10 px-2 py-1 text-xs text-[#68ff91]">Phone on account · not OTP verified</span>
                {isStaff && <span className="rounded-full bg-white/10 px-2 py-1 text-xs">STAFF</span>}
              </div>
            </div>
          </div>
          <button className="ghost-btn flex min-h-11 items-center gap-2" onClick={onSignOut}><LogOut size={16}/> Sign out</button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="glass p-4">
            <WalletCards className="gold" size={18}/>
            <p className="muted mt-3 text-xs">KES Wallet</p>
            <p className="mt-1 text-xl font-bold">{formatKES(profile.balance)}</p>
            <p className="mt-3 text-xs muted">Deposits and withdrawals are disabled.</p>
          </div>
          <button type="button" className="glass p-4 text-left transition hover:border-[#ffd60a]/50" onClick={() => setTokenomicsOpen(true)} aria-label="Open MCG tokenomics">
            <Coins className="gold" size={18}/>
            <p className="muted mt-3 text-xs">MCG Balance</p>
            <p className="mt-1 text-xl font-bold gold">{mcgBalance.toLocaleString()} MCG</p>
            <p className="mt-3 text-xs muted">View tokenomics</p>
          </button>
          <div className="glass p-4"><p className="muted text-xs">My Listings</p><p className="mt-2 text-2xl font-bold">{listings.length}</p></div>
          <div className="glass p-4"><p className="muted text-xs">My Trades</p><p className="mt-2 text-2xl font-bold">{trades.length}</p></div>
        </div>
        {message && <p className="mt-3 text-sm gold" role="status">{message}</p>}
      </div>

      <div className="glass p-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {tabs.map(item => <button className={`min-h-11 shrink-0 rounded-xl px-4 text-sm ${tab === item ? 'bg-[#ffd60a] text-black' : 'muted'}`} key={item} onClick={() => setTab(item)}>{item}</button>)}
        </div>
        {tab === 'My Orders' ? <OrdersPanel userId={userId}/> : tab === 'Settings' ? (
          <div className="space-y-4 p-4">
            <div className="flex items-center justify-between"><span>Account</span><span className="muted">{maskPhone(profile.phone)}</span></div>
            <div className="flex items-center justify-between gap-3"><span>Password</span><button className="ghost-btn flex items-center gap-2 text-sm" onClick={async () => { setShowPassword(!showPassword); await sendPasswordReset() }}>{showPassword ? <EyeOff size={15}/> : <Eye size={15}/>} Reset password</button></div>
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {(tab === 'My Listings' ? listings : trades).length ? (tab === 'My Listings' ? listings : trades).map((row, index) => {
              const label = tab === 'My Listings' ? String((row as Listing).product || (row as Listing).category || 'Produce') : String((row as Trade).type || 'Trade')
              const value = tab === 'My Listings' ? formatKES((row as Listing).price) : String((row as Trade).type || 'Trade')
              return <div className="flex items-center justify-between rounded-xl bg-white/[.04] p-3 text-sm" key={String(row.id || index)}><span>{label}</span><span className="gold">{value}</span></div>
            }) : <p className="muted p-3 text-sm">Nothing here yet.</p>}
          </div>
        )}
      </div>
      {isStaff && <StaffPanel/>}
      <TokenomicsModal open={tokenomicsOpen} onClose={() => setTokenomicsOpen(false)}/>
    </section>
  )
}