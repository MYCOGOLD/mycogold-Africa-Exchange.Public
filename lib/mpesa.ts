import 'server-only'

type DarajaResponse = Record<string, unknown>

function darajaBaseUrl() {
  return process.env.MPESA_ENV === 'sandbox' || (process.env.MPESA_ENV !== 'production' && process.env.NODE_ENV !== 'production')
    ? 'https://sandbox.safaricom.co.ke'
    : 'https://api.safaricom.co.ke'
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing ${name} configuration.`)
  return value
}

export function getDarajaConfig() {
  return {
    baseUrl: darajaBaseUrl(),
    consumerKey: requiredEnv('MPESA_CONSUMER_KEY'),
    consumerSecret: requiredEnv('MPESA_CONSUMER_SECRET'),
    passkey: requiredEnv('MPESA_PASSKEY'),
    shortcode: requiredEnv('MPESA_SHORTCODE'),
    callbackUrl: requiredEnv('MPESA_CALLBACK_URL'),
  }
}

export function darajaTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = new Map(parts.map(part => [part.type, part.value]))
  return `${values.get('year')}${values.get('month')}${values.get('day')}${values.get('hour')}${values.get('minute')}${values.get('second')}`
}

export async function darajaAccessToken(config = getDarajaConfig()) {
  const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64')
  const response = await fetch(`${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  const body = await response.json() as DarajaResponse
  if (!response.ok || typeof body.access_token !== 'string') {
    throw new Error('Daraja authentication failed.')
  }
  return body.access_token
}

export async function darajaRequest<T extends DarajaResponse>(path: string, token: string, body: Record<string, unknown>) {
  const config = getDarajaConfig()
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  })
  const result = await response.json() as T
  if (!response.ok) throw new Error('Daraja request failed.')
  return result
}

export function stkPassword(shortcode: string, passkey: string, timestamp: string) {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64')
}