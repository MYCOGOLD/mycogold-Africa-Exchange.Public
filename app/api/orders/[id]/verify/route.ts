import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '../../../../../lib/supabase/server'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 })

  const trustedRole = String(user.app_metadata?.role || '').toLowerCase()
  const staffIds = new Set((process.env.STAFF_USER_IDS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean))
  if (!['admin', 'staff'].includes(trustedRole) && !staffIds.has(user.id.toLowerCase())) {
    return NextResponse.json({ error: 'ADMIN_REQUIRED' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 })
  }

  const trust = Number(body.trust)
  if (!Number.isFinite(trust) || trust < 0 || trust > 1) {
    return NextResponse.json({ error: 'INVALID_VERIFICATION_DATA' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !serviceKey) return NextResponse.json({ error: 'ADMIN_ORDER_ACCESS_UNAVAILABLE' }, { status: 503 })
  const admin = createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })

  const { data: order, error: orderError } = await admin.from('orders')
    .select('id,listing_id,buyer_id,seller_id,quantity,unit_price,status,delivered_at,buyer_confirmed_at,disputed_at,escrow_released_at')
    .eq('id', id)
    .maybeSingle()
  if (orderError || !order) return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 })
  if (
    order.status !== 'PAID_ESCROW' || !order.delivered_at || !order.buyer_confirmed_at ||
    order.disputed_at || order.escrow_released_at ||
    Date.now() < new Date(order.buyer_confirmed_at).getTime() + 24 * 60 * 60 * 1000
  ) {
    return NextResponse.json({ error: 'ORDER_NOT_READY_FOR_ESCROW_RELEASE' }, { status: 409 })
  }

  const { data: listing, error: listingError } = await admin.from('listings')
    .select('category,product')
    .eq('id', order.listing_id)
    .maybeSingle()
  if (listingError || !listing?.category) return NextResponse.json({ error: 'LISTING_NOT_FOUND' }, { status: 409 })

  const { data: rejectedCheck, error: qualityError } = await admin.from('quality_checks')
    .select('id')
    .eq('trade_id', id)
    .eq('grade', 'REJECT')
    .limit(1)
    .maybeSingle()
  if (qualityError) {
    console.error('Quality check status could not be verified:', qualityError)
    return NextResponse.json({ error: 'QUALITY_STATUS_UNAVAILABLE' }, { status: 503 })
  }
  if (rejectedCheck) return NextResponse.json({ error: 'REJECTED_QUALITY_CHECK' }, { status: 409 })

  const verificationArgs = {
    category: listing.category,
    variety: listing.product || listing.category,
    price: Number(order.unit_price),
    kg: Number(order.quantity),
    trust,
    seller_id: order.seller_id,
    buyer_id: order.buyer_id,
    trade_id: order.id,
  }

  const { data: verification, error: verifyError } = await admin.rpc('verify_trade_and_reward', verificationArgs)
  if (verifyError) {
    console.error('Trade verification RPC failed:', verifyError)
    return NextResponse.json({ error: 'TRADE_VERIFICATION_FAILED' }, { status: 409 })
  }

  const { data: mfpi, error: mfpiError } = await admin.rpc('compute_mfpi_daily')
  if (mfpiError) {
    console.error('MFPI recompute RPC failed after trade verification:', mfpiError)
    return NextResponse.json({ error: 'MFPI_RECOMPUTE_FAILED', verification, escrowReleased: false }, { status: 503 })
  }

  const { data: releasedAt, error: releaseError } = await admin.rpc('release_order_escrow', { p_order_id: id })
  if (releaseError) {
    console.error('Escrow release transition failed:', releaseError)
    return NextResponse.json({ error: 'ESCROW_RELEASE_FAILED', verification, mfpi, escrowReleased: false }, { status: 409 })
  }

  return NextResponse.json({ verified: true, verification, mfpiUpdated: true, mfpi, escrowReleased: true, escrowReleasedAt: releasedAt })
}