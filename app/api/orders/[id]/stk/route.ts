import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { normalizePhone } from '../../../../../lib/normalizePhone'
import { darajaAccessToken, darajaRequest, darajaTimestamp, getDarajaConfig, stkPassword } from '../../../../../lib/mpesa'
import { createClient } from '../../../../../lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 })

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id,buyer_id,total_amount,status')
    .eq('id', id)
    .maybeSingle()
  if (orderError || !order || order.buyer_id !== user.id) {
    return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 })
  }
  if (!['requested', 'accepted'].includes(order.status)) {
    return NextResponse.json({ error: 'ORDER_NOT_PAYABLE' }, { status: 409 })
  }

  const amount = Number(order.total_amount)
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return NextResponse.json({ error: 'MPESA_REQUIRES_WHOLE_KES_AMOUNT' }, { status: 400 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('phone')
    .eq('id', user.id)
    .maybeSingle()
  const phone = normalizePhone(profile?.phone)
  const phoneNumber = phone.replace(/\D/g, '')
  if (profileError || !/^254\d{9}$/.test(phoneNumber)) {
    return NextResponse.json({ error: 'VALID_BUYER_PHONE_REQUIRED' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !serviceKey) return NextResponse.json({ error: 'PAYMENT_SERVICE_UNAVAILABLE' }, { status: 503 })

  const admin = createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })

  const { data: pendingPayment, error: pendingError } = await admin.from('payments')
    .select('id,checkout_request_id,created_at')
    .eq('order_id', order.id)
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (pendingError) return NextResponse.json({ error: 'PAYMENT_STATUS_UNAVAILABLE' }, { status: 503 })
  if (pendingPayment?.checkout_request_id) {
    return NextResponse.json({ status: 'PENDING', message: 'An M-Pesa prompt is already pending for this order.' })
  }
  if (pendingPayment) {
    const ageMs = Date.now() - new Date(pendingPayment.created_at).getTime()
    if (ageMs < 2 * 60 * 1000) {
      return NextResponse.json({ error: 'PAYMENT_REQUEST_IN_PROGRESS' }, { status: 409 })
    }
    await admin.from('payments').update({ status: 'FAILED', result_code: 'REQUEST_TIMEOUT', result_description: 'No STK request ID was recorded.' }).eq('id', pendingPayment.id)
  }

  const { data: payment, error: paymentError } = await admin
    .from('payments')
    .insert({ order_id: order.id, amount_kes: amount, phone_number: phoneNumber, status: 'PENDING' })
    .select('id')
    .single()
  if (paymentError || !payment) {
    console.error('Payment attempt could not be created:', paymentError)
    return NextResponse.json({ error: paymentError?.code === '23505' ? 'PAYMENT_REQUEST_IN_PROGRESS' : 'PAYMENT_ATTEMPT_UNAVAILABLE' }, { status: paymentError?.code === '23505' ? 409 : 503 })
  }

  try {
    const config = getDarajaConfig()
    const callback = new URL(config.callbackUrl)
    if (
      callback.protocol !== 'https:' ||
      callback.pathname !== '/api/payments/mpesa/callback' ||
      (callback.searchParams.get('token') || '').length < 32
    ) {
      throw new Error('MPESA_CALLBACK_URL must be the HTTPS callback route with a 32-character token.')
    }
    const timestamp = darajaTimestamp()
    const token = await darajaAccessToken(config)
    const result = await darajaRequest('/mpesa/stkpush/v1/processrequest', token, {
      BusinessShortCode: config.shortcode,
      Password: stkPassword(config.shortcode, config.passkey, timestamp),
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phoneNumber,
      PartyB: config.shortcode,
      PhoneNumber: phoneNumber,
      CallBackURL: config.callbackUrl,
      AccountReference: `ORD${String(order.id).replace(/-/g, '').slice(0, 9)}`,
      TransactionDesc: 'Produce order payment',
    })

    if (String(result.ResponseCode) !== '0' || typeof result.CheckoutRequestID !== 'string') {
      await admin.from('payments').update({ status: 'FAILED', result_code: String(result.ResponseCode || 'STK_REJECTED'), result_description: String(result.ResponseDescription || 'Daraja rejected the STK request.') }).eq('id', payment.id)
      return NextResponse.json({ error: String(result.CustomerMessage || 'Daraja rejected the STK request.') }, { status: 502 })
    }

    const { error: updateError } = await admin.from('payments').update({
      checkout_request_id: result.CheckoutRequestID,
      merchant_request_id: typeof result.MerchantRequestID === 'string' ? result.MerchantRequestID : null,
      updated_at: new Date().toISOString(),
    }).eq('id', payment.id)
    if (updateError) {
      console.error('STK request IDs could not be persisted:', updateError)
      return NextResponse.json({ error: 'PAYMENT_TRACKING_UNAVAILABLE' }, { status: 503 })
    }

    return NextResponse.json({ status: 'PENDING', message: 'Check your phone and enter your M-Pesa PIN to pay into escrow.' })
  } catch (error) {
    await admin.from('payments').update({ status: 'FAILED', result_code: 'REQUEST_ERROR', result_description: error instanceof Error ? error.message.slice(0, 500) : 'STK request failed.' }).eq('id', payment.id)
    console.error('Daraja STK request failed:', error)
    return NextResponse.json({ error: 'MPESA_STK_REQUEST_FAILED' }, { status: 503 })
  }
}