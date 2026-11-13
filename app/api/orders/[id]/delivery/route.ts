import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 })

  const { data, error } = await supabase.rpc('mark_order_delivered', { p_order_id: id })
  if (error) {
    console.error('Order delivery confirmation failed:', error)
    return NextResponse.json({ error: error.message }, { status: 409 })
  }
  return NextResponse.json({ status: 'DELIVERED', delivered_at: data })
}