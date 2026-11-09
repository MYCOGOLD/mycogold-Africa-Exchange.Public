'use client'

import { FormEvent, useState } from 'react'
import { Eye, EyeOff, LockKeyhole, X } from 'lucide-react'
import { createClient } from '../lib/supabase'
import { normalizePhone, phoneToEmail } from '../lib/normalizePhone'

const counties = ['Bomet', 'Kericho', 'Nakuru', 'Uasin Gishu', 'Nairobi', 'Kisumu', 'Kisii', 'Other']
const roles = ['Farmer', 'Buyer', 'Trader', 'Transporter']

export function AuthModal({
  open,
  onClose,
  onAuthed,
}: {
  open: boolean
  onClose: () => void
  onAuthed: () => void
}) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [county, setCounty] = useState('')
  const [role, setRole] = useState('Farmer')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const supabase = createClient()

      if (mode === 'forgot') {
        if (!phone.includes('@')) {
          setMessage('Password recovery requires the real email address linked to the account. Legacy phone-only accounts need support assistance.')
          return
        }
        const { error } = await supabase.auth.resetPasswordForEmail(phone.trim().toLowerCase(), {
          redirectTo: `${window.location.origin}/auth/callback`,
        })
        setMessage(error
          ? 'Could not send the recovery email. Check the address and try again.'
          : 'If an account exists, recovery instructions have been sent.')
        return
      }

      const normalizedPhone = normalizePhone(phone)
      if (!normalizedPhone) {
        setMessage('Enter a valid phone number.')
        return
      }

      const authEmail = mode === 'signup'
        ? email.trim().toLowerCase()
        : phone.includes('@')
          ? phone.trim().toLowerCase()
          : phoneToEmail(normalizedPhone)

      const result = mode === 'signup'
        ? await supabase.auth.signUp({
            email: authEmail,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
              data: { phone: normalizedPhone, name, county, role },
            },
          })
        : await supabase.auth.signInWithPassword({ email: authEmail, password })

      if (result.error) {
        setMessage(mode === 'signup'
          ? result.error.message
          : 'Invalid email/phone or password.')
        return
      }

      if (mode === 'signup' && result.data.user) {
        const profile = {
          id: result.data.user.id,
          phone: normalizedPhone,
          name: name.trim(),
        }
        const profileResult = await supabase.from('profiles').upsert(profile)
        if (profileResult.error && typeof window !== 'undefined') {
          localStorage.setItem('mycogold-pending-profile', JSON.stringify(profile))
        }

        if (!result.data.session) {
          setMessage('Account created. Check your real email for the confirmation link, then sign in using that email.')
          setMode('signin')
          setPhone(authEmail)
          return
        }
      }

      onAuthed()
      onClose()
    } catch {
      setMessage('Please try again. If the problem continues, contact support.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="glass gold-border relative w-full max-w-md p-6">
        <button className="ghost-btn absolute right-4 top-4 p-2" onClick={onClose} aria-label="Close">
          <X size={18}/>
        </button>
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-[#ffd60a] text-black">
            <LockKeyhole size={19}/>
          </div>
          <div>
            <p className="mono text-[10px] uppercase tracking-[.24em] gold">MYCOGOLD</p>
            <h2 id="auth-title" className="text-xl font-bold">
              {mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Reset access' : 'Sign in'}
            </h2>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && <>
            <input className="field min-h-11" value={name} onChange={event => setName(event.target.value)} placeholder="Full name" aria-label="Full name" required/>
            <input className="field min-h-11" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Real email address" aria-label="Email address" autoComplete="email" required/>
            <select className="field min-h-11" value={county} onChange={event => setCounty(event.target.value)} aria-label="County" required>
              <option value="">County</option>
              {counties.map(item => <option key={item}>{item}</option>)}
            </select>
            <select className="field min-h-11" value={role} onChange={event => setRole(event.target.value)} aria-label="Role">
              {roles.map(item => <option key={item}>{item}</option>)}
            </select>
          </>}

          <input
            className="field min-h-11"
            type={mode === 'forgot' ? 'email' : mode === 'signin' ? 'text' : 'tel'}
            value={phone}
            onChange={event => setPhone(event.target.value)}
            placeholder={mode === 'forgot' ? 'Real email address' : mode === 'signin' ? 'Email or legacy phone number' : 'Phone number'}
            aria-label={mode === 'forgot' ? 'Email address' : 'Phone number'}
            autoComplete="username"
            required
          />

          {mode !== 'forgot' && (
            <div className="relative">
              <input
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className="field min-h-11 pr-12"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Password"
                aria-label="Password"
                type={showPassword ? 'text' : 'password'}
                minLength={mode === 'signup' ? 12 : undefined}
                required
              />
              <button type="button" className="absolute right-2 top-2 grid size-7 place-items-center muted" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}
              </button>
            </div>
          )}

          {mode === 'forgot' && (
            <p className="text-xs muted">Recovery is sent only to a real email address. Legacy phone-only accounts need support assistance.</p>
          )}
          {message && <p className="text-sm text-[#ffcc61]" role="status">{message}</p>}

          <button className="gold-btn min-h-11 w-full" disabled={loading}>
            {loading ? 'Working…' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send recovery' : 'Sign in'}
          </button>
        </form>

        <button className="mt-4 w-full text-sm muted underline" onClick={onClose}>Continue as Guest</button>
        <div className="mt-5 flex flex-wrap justify-between gap-2 text-sm muted">
          <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage('') }}>
            {mode === 'signup' ? 'Already have an account? Sign in' : 'Create a new account'}
          </button>
          <button onClick={() => { setMode(mode === 'forgot' ? 'signin' : 'forgot'); setMessage('') }}>
            {mode === 'forgot' ? 'Back to sign in' : 'Forgot password?'}
          </button>
        </div>
      </div>
    </div>
  )
}
