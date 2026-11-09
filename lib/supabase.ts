import { createClient as createBrowserClient } from '@supabase/supabase-js'

export type Profile = { id: string; phone: string | null; name: string | null; county?: string | null; role?: string | null; balance: number | null; created_at?: string }
export type Listing = { id: string; seller_id: string | null; category: string | null; product: string | null; location: string | null; price: number | null; quantity: number | null; seller: string | null; status?: string | null; photo_path?: string | null; verified_at?: string | null; tusk_status?: string | null; network_stamp?: string | null; created_at?: string; updated_at?: string }
export type Trade = { id: string; user_id: string; type: 'buy' | 'sell'; hub: string | null; kg: number | null; price: number | null; total: number | null; created_at?: string }

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.')
  }

  return { url, anonKey }
}

export function createClient() {
  const { url, anonKey } = getSupabaseConfig()

  return createBrowserClient(url, anonKey, {
    auth: {
      persistSession: true,
      storageKey: 'mycogold-auth',
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}
