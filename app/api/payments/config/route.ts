import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const callbackUrl = process.env.MPESA_CALLBACK_URL
  let validCallback = false
  try {
    const parsed = new URL(callbackUrl || '')
    validCallback = parsed.protocol === 'https:'
      && parsed.pathname === '/api/payments/mpesa/callback'
      && (parsed.searchParams.get('token') || '').length >= 32
  } catch {
    validCallback = false
  }

  const enabled = Boolean(
    process.env.MPESA_CONSUMER_KEY
    && process.env.MPESA_CONSUMER_SECRET
    && process.env.MPESA_PASSKEY
    && process.env.MPESA_SHORTCODE
    && validCallback,
  )
  return NextResponse.json({ enabled }, { headers: { 'Cache-Control': 'no-store' } })
}