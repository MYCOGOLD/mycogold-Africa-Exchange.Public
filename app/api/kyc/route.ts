import { NextResponse } from 'next/server';
// FAIL-CLOSED KYC: no provider configured, no real verification.
// Never trust body userId, never mark VERIFIED without a trusted provider result.
export async function POST(req: Request) {
  // Auth must be verified here with the repo's server Supabase helper.
  // If no verified session, return 401. This stub returns 503 to fail closed
  // until server auth + real provider are wired. Do NOT return VERIFIED.
  await req.text().catch(() => '');
  // Do NOT log or retain idNumber / selfiePhoto from the body.
  return NextResponse.json({ status: 'UNAVAILABLE', verified: false, message: 'KYC verification is unavailable. No trusted provider is configured. Your submission was not verified.' }, { status: 503 });
}
