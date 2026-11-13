import { createClient } from '../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('mfpi_daily')
      .select('category,trade_date,mfpi_value,total_verified_kg,total_verified_trades,status,computed_at')
      .eq('trade_date', today)
      .order('category')

    if (error) throw error
    return Response.json(
      { status: 'ok', service: 'mycogold', mfpi: data || [], time: new Date().toISOString() },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    )
  } catch {
    return Response.json(
      { status: 'unavailable', service: 'mycogold', mfpi: [], time: new Date().toISOString() },
      { status: 503, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    )
  }
}