import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'DELIVERY_TRACKING_NOT_CONFIGURED' }, { status: 503 })
}