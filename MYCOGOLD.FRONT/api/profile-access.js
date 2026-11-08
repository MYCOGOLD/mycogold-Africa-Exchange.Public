function normalizeForCompare(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('254')) return `+${digits}`
  if (digits.startsWith('0') && digits.length === 10) return `+254${digits.slice(1)}`
  if (digits.startsWith('7') && digits.length === 9) return `+254${digits}`
  return digits ? `+${digits}` : ''
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'private, no-store')
  if (request.method !== 'GET') return response.status(405).json({ isStaff: false })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const authorization = request.headers.authorization
  if (!url || !key || !authorization?.startsWith('Bearer ')) return response.status(401).json({ isStaff: false })
  try {
    const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: authorization } })
    if (!userResponse.ok) return response.status(401).json({ isStaff: false })
    const user = await userResponse.json()
    const staffPhones = (process.env.STAFF_PHONES || '').split(',').map(normalizeForCompare).filter(Boolean)
    const userPhone = normalizeForCompare(user.phone)
    const userEmailDigits = String(user.email || '').split('@')[0]
    const isStaff = staffPhones.includes(userPhone) || staffPhones.some(phone => phone.replace(/\D/g, '') === userEmailDigits)
    return response.status(200).json({ isStaff })
  } catch (error) {
    console.error('[v0] profile access check failed', error)
    return response.status(500).json({ isStaff: false })
  }
}
