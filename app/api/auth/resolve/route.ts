import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Resolve phone -> email for login. Server only.
// NEVER return email to client in plain text in logs. Return it only for immediate sign-in.
export async function POST(req: Request) {
  try {
    const { identifier } = await req.json();
    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json({ error: 'Enter email or phone.' }, { status: 400 });
    }
    const clean = identifier.trim();
    // If it's already an email, use it directly
    if (clean.includes('@')) {
      return NextResponse.json({ email: clean.toLowerCase() });
    }
    // Normalize Kenyan phone: 079... -> +25479..., 25479... -> +25479...
    let phone = clean.replace(/[\s-]/g, '');
    if (/^0\d{9}$/.test(phone)) phone = '+254' + phone.slice(1);
    if (/^254\d{9}$/.test(phone)) phone = '+' + phone;
    if (!/^\+254\d{9}$/.test(phone)) {
      return NextResponse.json({ error: 'Enter a valid email or 07... phone.' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // 1. Find user_id from profiles by phone - try both formats
    const { data: profile } = await admin
      .from('profiles')
      .select('id, user_id')
      .or(`phone.eq.${phone},phone.eq.${clean}`)
      .maybeSingle();

    const userId = (profile as any)?.user_id ?? (profile as any)?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Invalid email/phone or password.' }, { status: 401 });
    }
    // 2. Get that user's real Auth email via Admin API
    const { data: userRes, error } = await admin.auth.admin.getUserById(userId);
    const email = userRes?.user?.email;
    if (error || !email) {
      return NextResponse.json({ error: 'Invalid email/phone or password.' }, { status: 401 });
    }
    return NextResponse.json({ email });
  } catch {
    return NextResponse.json({ error: 'Login unavailable. Try again.' }, { status: 503 });
  }
}
