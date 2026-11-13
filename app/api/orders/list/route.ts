import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams
  const status = search.get('status') ?? 'ACTIVE'
  const orderId = search.get('orderId')
  if (!['ACTIVE', 'PAST'].includes(status)) return NextResponse.json({ error: 'INVALID_STATUS' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 })

  const trustedRole = String(user.app_metadata?.role || '').toLowerCase()
  const staffIds = new Set((process.env.STAFF_USER_IDS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean))
  const isAdmin = ['admin', 'staff'].includes(trustedRole) || staffIds.has(user.id.toLowerCase())
  let dataClient = supabase
  if (isAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
    if (!url || !serviceKey) return NextResponse.json({ error: 'ADMIN_ORDER_ACCESS_UNAVAILABLE' }, { status: 503 })
    dataClient = createSupabaseClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })
  }

  let query = dataClient
    .from('orders')
    .select('id,listing_id,buyer_id,seller_id,quantity,unit_price,total_amount,status,created_at,delivered_at,buyer_confirmed_at,disputed_at,escrow_released_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (orderId) query = query.eq('id', orderId)

  const { data: orderRows, error: orderError } = await query
  if (orderError) {
    console.error('Order list query failed:', orderError)
    return NextResponse.json({ error: 'ORDERS_UNAVAILABLE' }, { status: 503 })
  }
  if (orderId && !orderRows?.length) return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 })

  const listingIds = [...new Set((orderRows || []).map(order => order.listing_id))]
  const { data: listingRows, error: listingError } = listingIds.length
    ? await dataClient.from('listings').select('id,category,product,location').in('id', listingIds)
    : { data: [], error: null }
  if (listingError) {
    console.error('Order listing details query failed:', listingError)
    return NextResponse.json({ error: 'ORDERS_UNAVAILABLE' }, { status: 503 })
  }

  const listings = new Map((listingRows || []).map(listing => [listing.id, listing]))
  const joinedOrders = (orderRows || []).map(order => ({ ...order, listing: listings.get(order.listing_id) || null }))
  const orders = orderId ? joinedOrders : joinedOrders.filter(order => {
    const past = ['rejected', 'cancelled', 'COMPLETED'].includes(order.status)
    return status === 'PAST' ? past : !past
  })

  return NextResponse.json(
    { orders, viewerId: user.id, isAdmin },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' } },
  )
}