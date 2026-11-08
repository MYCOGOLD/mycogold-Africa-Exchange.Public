import { createClient as createBrowserClient } from '@supabase/supabase-js'

export type Profile = { id: string; phone: string | null; name: string | null; balance: number | null; created_at?: string }
export type Listing = { id: string; seller_id: string | null; category: string | null; product: string | null; location: string | null; price: number | null; quantity: number | null; seller: string | null; created_at?: string; updated_at?: string }
export type Trade = { id: string; user_id: string; type: 'buy' | 'sell'; hub: string | null; kg: number | null; price: number | null; total: number | null; created_at?: string }
export function createClient() { return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: true, storageKey: 'mycogold-auth', autoRefreshToken: true, detectSessionInUrl: true } }) }
