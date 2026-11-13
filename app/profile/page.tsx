'use client'

import { useEffect, useState } from 'react'
import { AuthModal } from '../../components/auth-modal'
import { ProfileGuest } from '../../components/ProfileGuest'
import { ProfileLoggedIn } from '../../components/ProfileLoggedIn'
import { createClient } from '../../lib/supabase'

async function checkStaffAccess(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch('/api/profile-access', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })

    if (!response.ok) return false

    const result: { isStaff?: boolean } = await response.json()
    return result.isStaff === true
  } catch {
    return false
  }
}

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [isStaff, setIsStaff] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadSession() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error

        const session = data.session
        if (!active) return

        setUserId(session?.user.id ?? null)
        setIsStaff(false)

        if (session?.access_token) {
          const staff = await checkStaffAccess(session.access_token)
          if (active) setIsStaff(staff)
        }
      } catch {
        if (active) {
          setUserId(null)
          setIsStaff(false)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadSession()

    return () => {
      active = false
    }
  }, [])

  const handleAuthed = async () => {
    const supabase = createClient()
    const { data, error } = await supabase.auth.getSession()

    if (error || !data.session) {
      setUserId(null)
      setIsStaff(false)
      setAuthOpen(false)
      return
    }

    setUserId(data.session.user.id)
    setIsStaff(false)
    setAuthOpen(false)

    const staff = await checkStaffAccess(data.session.access_token)
    setIsStaff(staff)
  }

  if (loading) {
    return (
      <main className="shell mx-auto max-w-md p-6 text-center text-sm muted md:max-w-6xl md:p-8">
        Loading profile…
      </main>
    )
  }

  return (
    <main>
      <div className="shell pt-4"><a className="ghost-btn inline-flex min-h-10 items-center gap-2" href="/"><span aria-hidden="true">←</span> Back to Marketplace</a></div>
      {userId ? (
        <ProfileLoggedIn
          userId={userId}
          isStaff={isStaff}
          onSignOut={async () => {
            await createClient().auth.signOut()
            setUserId(null)
            setIsStaff(false)
          }}
        />
      ) : (
        <ProfileGuest onSignIn={() => setAuthOpen(true)} />
      )}

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onAuthed={handleAuthed} />
    </main>
  )
}
