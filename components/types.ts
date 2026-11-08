export type LivePrice = { id?: number; tick?: number; mfpi?: number; hubs?: unknown; proof?: unknown; updated_at?: string }
export type Listing = { id: string; seller_id: string | null; category: string | null; product: string | null; location: string | null; price: number | null; quantity: number | null; seller: string | null; created_at?: string; updated_at?: string }
