import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'ESCROW_NOT_CONFIGURED' }, { status: 503 })
}