import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const latitude = Number(body.latitude)
    const longitude = Number(body.longitude)
    const rating = Number(body.rating)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isInteger(rating)) {
      return NextResponse.json({ error: 'GPS_AND_RATING_REQUIRED' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 })

    const { data, error } = await supabase.rpc('confirm_verified_order', {
      p_order_id: id,
      p_latitude: latitude,
      p_longitude: longitude,
      p_rating: rating,
    })
    if (error) {
      console.error('Verified order confirmation failed:', error)
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
  } catch (error) {
    console.error('Verified order confirmation request failed:', error)
    return NextResponse.json({ error: 'INVALID_CONFIRMATION_REQUEST' }, { status: 400 })
  }
}