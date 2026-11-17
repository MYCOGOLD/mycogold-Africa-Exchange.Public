import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  return NextResponse.json(
    { error: 'PAYMENTS_NOT_AVAILABLE' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
