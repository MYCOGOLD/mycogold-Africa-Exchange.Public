export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null,
    redirectUrl: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || null,
  })
}
