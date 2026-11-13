import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 })

  const { data: order, error } = await supabase
    .from('orders')
    .select('id,buyer_id,quantity,unit_price,total_amount,payment_status')
    .eq('id', id)
    .maybeSingle()
  if (error || !order || order.buyer_id !== user.id) {
    return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json({
    order_id: order.id,
    invoice: {
      currency: 'KES',
      quantity_kg: Number(order.quantity),
      unit_price_kes: Number(order.unit_price),
      total_kes: Number(order.total_amount),
    },
    payment: { status: order.payment_status, available: false, reason: 'MPESA_NOT_CONFIGURED' },
  }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
}