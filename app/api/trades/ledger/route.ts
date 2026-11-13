import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// REAL TRADE LEDGER - READ ONLY
// Source: public.verified_trades only. No verified trade = empty list, not demo data.
// Never trust client-supplied price / kg / trust_score / seller / buyer.
// MFPI is NOT calculated here. This route returns verified trades only.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category')?.trim() || null;
  const limit = Math.min(Number(searchParams.get('limit') || 50) || 50, 100);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to view the trade ledger.' }, { status: 401 });
  }

  let query = supabase
    .from('verified_trades')
    .select('trade_id, verified_price_kes, verified_kg, category, variety, seller_id, buyer_id, verified_at')
    .order('verified_at', { ascending: false })
    .limit(limit);

  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Trade ledger unavailable. Try again.' }, { status: 503 });
  }

  // Never return trust_score - it must not be used as a weight for MFPI
  return NextResponse.json({
    source: 'verified_trades',
    count: data?.length ?? 0,
    trades: (data ?? []).map(t => ({
      trade_id: t.trade_id,
      category: t.category,
      variety: t.variety,
      price_kes: t.verified_price_kes,
      kg: t.verified_kg,
      verified_at: t.verified_at,
      // Do NOT expose seller_id / buyer_id in public list - keep participant privacy
    })),
  });
}
