import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'DISPUTE_REVIEW_NOT_CONFIGURED' }, { status: 503 })
}