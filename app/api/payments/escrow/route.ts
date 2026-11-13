import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 })

  const { data, error } = await supabase.from('payments')
    .select('id,order_id,amount_kes,mpesa_receipt,status,created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) {
    console.error('Escrow payments query failed:', error)
    return NextResponse.json({ error: 'ESCROW_ORDERS_UNAVAILABLE' }, { status: 503 })
  }

  return NextResponse.json({ payments: data || [] }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
}