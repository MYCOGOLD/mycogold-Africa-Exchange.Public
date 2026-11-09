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
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
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
    const [listingsResult, tradesResult] = await Promise.all([
      admin.from('listings').select('*').order('created_at', { ascending: false }).limit(100),
      admin.from('trades').select('*').order('created_at', { ascending: false }).limit(100),
    ])

    if (listingsResult.error || tradesResult.error) {
      console.error('Staff workspace data fetch failed:', listingsResult.error || tradesResult.error)
      return response({ error: 'Could not load staff workspace data.' }, 500)
    }

    const sellerIds = [...new Set((listingsResult.data || [])
      .map((listing) => listing.seller_id)
      .filter((sellerId): sellerId is string => typeof sellerId === 'string'))]
    const profilesResult = sellerIds.length
      ? await admin.from('profiles').select('id,phone,name').in('id', sellerIds)
      : { data: [], error: null }

    if (profilesResult.error) {
      console.error('Staff seller contact lookup failed:', profilesResult.error)
      return response({ error: 'Could not load seller review details.' }, 500)
    }

    const profilesById = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]))
    const listings = (listingsResult.data || []).map((listing) => {
      const sellerProfile = listing.seller_id ? profilesById.get(listing.seller_id) : undefined
      return {
        ...listing,
        seller_phone: sellerProfile?.phone || null,
        seller_profile_name: sellerProfile?.name || null,
      }
    })

    return response({
      listings,
      trades: tradesResult.data || [],
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
      | { id?: unknown; status?: unknown; sellerContactConfirmed?: unknown }
      | null
    const id = typeof body?.id === 'string' ? body.id : ''
    const status = body?.status

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return response({ error: 'A valid listing ID is required.' }, 400)
    }
    if (status !== 'active' && status !== 'inactive') {
      return response({ error: 'Status must be active or inactive.' }, 400)
    }
    if (status === 'active' && body?.sellerContactConfirmed !== true) {
      return response({ error: 'Confirm that you manually contacted and checked the seller before approval.' }, 400)
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })

    const { data: listing, error: updateError } = await admin.rpc('moderate_listing', {
      p_listing_id: id,
      p_status: status,
      p_actor_id: data.user.id,
      p_seller_contact_confirmed: status === 'active' && body?.sellerContactConfirmed === true,
    })

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
