import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function jsonResponse(body: { isStaff: boolean }, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      Vary: 'Authorization',
    },
  })
}

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization')
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]

  if (!token) return jsonResponse({ isStaff: false }, 401)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    console.error('Profile access check is missing Supabase server configuration.')
    return jsonResponse({ isStaff: false }, 503)
  }

  try {
    // getUser(token) verifies the JWT with Supabase Auth. Never trust user_metadata
    // or a phone number supplied by the browser for staff authorization.
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })

    const { data, error } = await supabase.auth.getUser(token)

    if (error || !data.user) return jsonResponse({ isStaff: false }, 401)

    const staffIds = new Set(
      (process.env.STAFF_USER_IDS || '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    )

    // app_metadata is managed by trusted server/admin operations; unlike
    // user_metadata, a normal user cannot edit it from the client.
    const trustedRole = String(data.user.app_metadata?.role || '').toLowerCase()
    const isStaff =
      staffIds.has(data.user.id.toLowerCase()) ||
      trustedRole === 'staff' ||
      trustedRole === 'admin'

    return jsonResponse({ isStaff })
  } catch (error) {
    console.error('Profile access verification failed:', error)
    return jsonResponse({ isStaff: false }, 503)
  }
}
