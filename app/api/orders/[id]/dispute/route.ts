import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  let reason: string
  try {
    const body = await request.json()
    reason = String(body.reason || '').trim()
  } catch {
    return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 })
  }
  if (!reason) return NextResponse.json({ error: 'DISPUTE_REASON_REQUIRED' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 })

  const { data, error } = await supabase.rpc('dispute_order', { p_order_id: id, p_reason: reason })
  if (error) {
    console.error('Order dispute could not be recorded:', error)
    return NextResponse.json({ error: error.message }, { status: 409 })
  }
  return NextResponse.json({ status: 'DISPUTED', disputed_at: data })
}