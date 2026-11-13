import { NextResponse } from 'next/server'
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

  const { category, variety, seller_id, buyer_id, trade_id } = body
  const price = Number(body.price)
  const kg = Number(body.kg)
  const trust = Number(body.trust)
  if (
    typeof category !== 'string' || !category.trim() ||
    typeof variety !== 'string' || !variety.trim() ||
    typeof seller_id !== 'string' || typeof buyer_id !== 'string' ||
    trade_id !== id || !Number.isFinite(price) || price <= 0 ||
    !Number.isFinite(kg) || kg <= 0 || !Number.isFinite(trust) || trust < 0 || trust > 1
  ) {
    return NextResponse.json({ error: 'INVALID_VERIFICATION_DATA' }, { status: 400 })
  }

  const { data: verification, error: verifyError } = await supabase.rpc('verify_trade_and_reward', {
    category,
    variety,
    price,
    kg,
    trust,
    seller_id,
    buyer_id,
    trade_id,
  })
  if (verifyError) {
    console.error('Trade verification RPC failed:', verifyError)
    return NextResponse.json({ error: 'TRADE_VERIFICATION_FAILED' }, { status: 409 })
  }

  const { data: mfpi, error: mfpiError } = await supabase.rpc('compute_mfpi_daily')
  if (mfpiError) {
    console.error('MFPI recompute RPC failed after trade verification:', mfpiError)
    return NextResponse.json({ verified: true, verification, mfpiUpdated: false }, { status: 200 })
  }

  return NextResponse.json({ verified: true, verification, mfpiUpdated: true, mfpi })
}