import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  return NextResponse.json(
    { error: 'ORDER_SETTLEMENT_NOT_AVAILABLE' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
