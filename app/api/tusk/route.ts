import { NextResponse } from 'next/server';
// Server boundary for Tusk. Client must NEVER insert role='assistant'.
// Steps (wire with repo's server Supabase helper):
// 1. Verify session, derive user_id from session, 401 if no user.
// 2. Validate message 1..8000 chars.
// 3. Insert { user_id, role: 'user', message } into chat_messages.
// 4. Query live tables for selected hub: mushroom_spawn, veterinary_services, listings (asking only), weather via /api/weather.
// 5. If MFPI asked: use verified_trades only, else say MFPI unpublished if no confirmed trades.
// 6. If no verified match: "No verified result found for [hub]." + real Request Listing path if exists.
// 7. Insert assistant reply server-side, return reconciled history.
// 8. Never invent prices, availability, forecast, MFPI.
export async function POST() {
  return NextResponse.json({ error: 'Tusk server route not yet wired to server auth. Do not use client assistant inserts.' }, { status: 503 });
}
export async function GET() {
  return NextResponse.json({ error: 'Tusk history requires authenticated server route.' }, { status: 503 });
}
