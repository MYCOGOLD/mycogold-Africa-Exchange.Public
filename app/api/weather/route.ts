import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const locations = [
  { city: 'Kericho', latitude: -0.3677, longitude: 35.2831 },
  { city: 'Nakuru', latitude: -0.3031, longitude: 36.0800 },
  { city: 'Litein', latitude: -0.5820, longitude: 35.1890 },
  { city: 'Eldoret', latitude: 0.5143, longitude: 35.2698 },
]

function condition(code: number) {
  if (code === 0) return 'Clear'
  if ([1, 2].includes(code)) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code >= 45 && code <= 48) return 'Fog'
  if (code >= 51 && code <= 67) return 'Drizzle / rain'
  if (code >= 71 && code <= 77) return 'Snow'
  if (code >= 80 && code <= 82) return 'Rain showers'
  if (code >= 85 && code <= 86) return 'Snow showers'
  if (code >= 95) return 'Thunderstorm'
  return 'Unknown conditions'
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Weather cache service is unavailable.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET() {
  try {
    const supabase = serviceClient()
    const output = await Promise.all(locations.map(async location => {
      const { data: cached } = await supabase.from('weather_cache')
        .select('weather_data,fetched_at')
        .eq('city', location.city)
        .maybeSingle()
      const cachedAt = cached?.fetched_at ? new Date(cached.fetched_at).getTime() : 0
      if (cached?.weather_data && Date.now() - cachedAt < 15 * 60 * 1000) {
        return { city: location.city, ...cached.weather_data }
      }

      const url = new URL('https://api.open-meteo.com/v1/forecast')
      url.search = new URLSearchParams({
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code',
      }).toString()
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12000) })
      if (!response.ok) throw new Error('Weather unavailable')
      const result = await response.json()
      const current = result.current
      if (!current) throw new Error('Weather unavailable')

      const weatherData = {
        temperature: Number(current.temperature_2m),
        humidity: Number(current.relative_humidity_2m),
        precipitation: Number(current.precipitation),
        condition: condition(Number(current.weather_code)),
        bestFor: 'Mushroom / Potatoes',
      }
      const { error: cacheError } = await supabase.from('weather_cache').upsert({
        city: location.city,
        latitude: location.latitude,
        longitude: location.longitude,
        weather_data: weatherData,
        fetched_at: new Date().toISOString(),
      }, { onConflict: 'city' })
      if (cacheError) console.error('Weather cache write failed:', cacheError)
      return { city: location.city, ...weatherData }
    }))

    return NextResponse.json({ weather: output }, { headers: { 'Cache-Control': 'private, max-age=300' } })
  } catch (error) {
    console.error('Weather fetch failed:', error)
    return NextResponse.json({ error: 'Weather unavailable' }, { status: 503 })
  }
}