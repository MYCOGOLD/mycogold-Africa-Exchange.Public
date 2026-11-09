import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const response = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Authorization' },
  })


export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.match(/^Bearer\\s+(.+)$/i)?.[1]
  if (!token) return response({ error: 'Authentication required.' }, 401)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

  if (!url || !anonKey || !serviceKey) {
    return response({ error: 'Staff workspace is not configured on the server.' }, 503)
  }

  try {
    const authClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })
    const { data, error } = await authClient.auth.getUser(token)
    if (error || !data.user) return response({ error: 'Invalid session.' }, 401)

    const allowlisted = new Set(
      (process.env.STAFF_USER_IDS || '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    )
    const role = String(data.user.app_metadata?.role || '').toLowerCase()
    if (!allowlisted.has(data.user.id.toLowerCase()) && role !== 'staff' && role !== 'admin') {
      return response({ error: 'Staff access required.' }, 403)
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })
    const [listingsResult, tradesResult, priceResult] = await Promise.all([
      admin.from('listings').select('*').order('created_at', { ascending: false }).limit(100),
      admin.from('trades').select('*').order('created_at', { ascending: false }).limit(100),
      admin.from('live_prices').select('*').order('tick', { ascending: false }).limit(1).maybeSingle(),
    ])

    if (listingsResult.error || tradesResult.error || priceResult.error) {
      console.error('Staff workspace data fetch failed:', listingsResult.error || tradesResult.error || priceResult.error)
      return response({ error: 'Could not load staff workspace data.' }, 500)
    }

    return response({
      listings: listingsResult.data || [],
      trades: tradesResult.data || [],
      livePrice: priceResult.data || null,
    })
  } catch (error) {
    console.error('Staff workspace request failed:', error)
    return response({ error: 'Unable to load staff workspace.' }, 500)
  }
}

export async function PATCH(request: NextRequest) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return response({ error: 'Authentication required.' }, 401)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

  if (!url || !anonKey || !serviceKey) {
    console.error('Staff listing moderation is missing server-side Supabase configuration.')
    return response({ error: 'Staff moderation is not configured on the server.' }, 503)
  }

  try {
    const authClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })
    const { data, error } = await authClient.auth.getUser(token)
    if (error || !data.user) return response({ error: 'Invalid session.' }, 401)

    const allowlisted = new Set(
      (process.env.STAFF_USER_IDS || '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    )
    const role = String(data.user.app_metadata?.role || '').toLowerCase()
    const isStaff =
      allowlisted.has(data.user.id.toLowerCase()) || role === 'staff' || role === 'admin'

    if (!isStaff) return response({ error: 'Staff access required.' }, 403)

    const body = await request.json().catch(() => null) as
      | { id?: unknown; status?: unknown }
      | null
    const id = typeof body?.id === 'string' ? body.id : ''
    const status = body?.status

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return response({ error: 'A valid listing ID is required.' }, 400)
    }
    if (status !== 'active' && status !== 'inactive') {
      return response({ error: 'Status must be active or inactive.' }, 400)
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })
    const { data: listing, error: updateError } = await admin
      .from('listings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id,status')
      .maybeSingle()

    if (updateError) {
      console.error('Staff listing moderation failed:', updateError)
      return response({ error: 'Could not update listing.' }, 500)
    }
    if (!listing) return response({ error: 'Listing not found.' }, 404)

    return response({ listing })
  } catch (error) {
    console.error('Staff listing moderation request failed:', error)
    return response({ error: 'Unable to process moderation request.' }, 500)
  }
}
