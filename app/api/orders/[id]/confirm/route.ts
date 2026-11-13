import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 })

    const { data, error } = await supabase.rpc('confirm_order_delivery', { p_order_id: id })
    if (error) {
      console.error('Buyer delivery confirmation failed:', error)
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json({ status: 'DELIVERY_CONFIRMED', confirmed_at: data }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
  } catch (error) {
    console.error('Buyer delivery confirmation request failed:', error)
    return NextResponse.json({ error: 'DELIVERY_CONFIRMATION_FAILED' }, { status: 400 })
  }
}