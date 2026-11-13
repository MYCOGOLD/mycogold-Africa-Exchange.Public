import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { darajaAccessToken, darajaRequest, darajaTimestamp, getDarajaConfig, stkPassword } from '../../../../../lib/mpesa'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CallbackItem = { Name?: unknown; Value?: unknown }

function itemValue(items: CallbackItem[], name: string) {
  return items.find(item => item.Name === name)?.Value
}

function callbackTokenMatches(request: Request, callbackUrl: string) {
  const expected = new URL(callbackUrl)
  const received = new URL(request.url)
  const expectedToken = expected.searchParams.get('token')
  return expected.protocol === 'https:' && Boolean(expectedToken && expectedToken.length >= 32)
    && received.pathname === expected.pathname
    && received.searchParams.get('token') === expectedToken
}

export async function POST(request: Request) {
  let payload: Record<string, any>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_CALLBACK' }, { status: 400 })
  }

  try {
    const config = getDarajaConfig()
    if (!callbackTokenMatches(request, config.callbackUrl)) {
      return NextResponse.json({ error: 'CALLBACK_NOT_AUTHORIZED' }, { status: 401 })
    }

    const stkCallback = payload.Body?.stkCallback
    const checkoutRequestId = stkCallback?.CheckoutRequestID
    if (typeof checkoutRequestId !== 'string' || typeof stkCallback?.ResultCode === 'undefined') {
      return NextResponse.json({ error: 'INVALID_CALLBACK' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
    if (!url || !serviceKey) return NextResponse.json({ error: 'PAYMENT_SERVICE_UNAVAILABLE' }, { status: 503 })
    const admin = createSupabaseClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })

    const { data: payment, error: paymentError } = await admin
      .from('payments')
      .select('id,amount_kes,phone_number,status')
      .eq('checkout_request_id', checkoutRequestId)
      .maybeSingle()
    if (paymentError || !payment) {
      console.error('STK callback did not match a payment attempt:', paymentError)
      return NextResponse.json({ error: 'PAYMENT_ATTEMPT_NOT_FOUND' }, { status: 404 })
    }
    if (payment.status === 'PAID') return NextResponse.json({ ResultCode: 0, ResultDesc: 'Already processed.' })

    const accessToken = await darajaAccessToken(config)
    const timestamp = darajaTimestamp()
    const queryResult = await darajaRequest('/mpesa/stkpushquery/v1/query', accessToken, {
      BusinessShortCode: config.shortcode,
      Password: stkPassword(config.shortcode, config.passkey, timestamp),
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    })
    if (String(queryResult.ResponseCode) !== '0' || String(queryResult.ResultCode) !== String(stkCallback.ResultCode)) {
      return NextResponse.json({ error: 'CALLBACK_RESULT_NOT_CONFIRMED' }, { status: 409 })
    }

    const resultCode = String(stkCallback.ResultCode)
    const resultDescription = String(stkCallback.ResultDesc || queryResult.ResultDesc || '')
    const items = (stkCallback.CallbackMetadata?.Item || []) as CallbackItem[]
    const receipt = itemValue(items, 'MpesaReceiptNumber')
    const amount = Number(itemValue(items, 'Amount'))
    const phone = String(itemValue(items, 'PhoneNumber') || '')

    if (resultCode === '0') {
      if (
        typeof receipt !== 'string' || !receipt ||
        !Number.isFinite(amount) || amount !== Number(payment.amount_kes) ||
        phone !== payment.phone_number
      ) {
        return NextResponse.json({ error: 'CALLBACK_PAYMENT_DETAILS_MISMATCH' }, { status: 409 })
      }
    }

    const { data, error } = await admin.rpc('apply_mpesa_stk_callback', {
      p_checkout_request_id: checkoutRequestId,
      p_result_code: resultCode,
      p_result_description: resultDescription,
      p_mpesa_receipt: typeof receipt === 'string' ? receipt : null,
      p_amount: Number.isFinite(amount) ? amount : null,
    })
    if (error) {
      console.error('STK callback database transition failed:', error)
      return NextResponse.json({ error: 'PAYMENT_CALLBACK_PROCESSING_FAILED' }, { status: 503 })
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: String(data) })
  } catch (error) {
    console.error('M-Pesa callback processing failed:', error)
    return NextResponse.json({ error: 'PAYMENT_CALLBACK_PROCESSING_FAILED' }, { status: 503 })
  }
}