'use client'

import { useEffect, useState } from 'react'
import { AuthModal } from '../../components/auth-modal'
import { ProfileGuest } from '../../components/ProfileGuest'
import { ProfileLoggedIn } from '../../components/ProfileLoggedIn'
import { createClient } from '../../lib/supabase'

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [isStaff, setIsStaff] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadSession() {
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      const sessionUser = data.session?.user ?? null

      if (!active) return

      setUserId(sessionUser?.id ?? null)

      if (sessionUser && data.session?.access_token) {
        try {
          const response = await fetch('/api/profile-access', {
            headers: {
              Authorization: `Bearer ${data.session.access_token}`,
            },
          })

          if (response.ok) {
            const result = await response.json()
            setIsStaff(Boolean(result.isStaff))
          }
        } catch {
          setIsStaff(false)
        }
      } else {
        setIsStaff(false)
      }

      setLoading(false)
    }

    loadSession()

    return () => {
      active = false
    }
  }, [])

  const handleAuthed = async () => {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    setUserId(data.session?.user.id ?? null)
    setAuthOpen(false)

    if (data.session?.access_token && data.session.user) {
      try {
        const response = await fetch('/api/profile-access', {
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
          },
        })

        if (response.ok) {
          const result = await response.json()
          setIsStaff(Boolean(result.isStaff))
        }
      } catch {
        setIsStaff(false)
      }
    }
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
