import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      Vary: 'Authorization',
    },
  })
}

function detectImage(bytes: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png'
  }
  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return reply({ error: 'Authentication required.' }, 401)

  const contentLength = Number(request.headers.get('content-length') || 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES + 64 * 1024) {
    return reply({ error: 'Image upload exceeds the 5 MB limit.' }, 413)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !anonKey || !serviceKey) {
    return reply({ error: 'Secure image upload is not configured on the server.' }, 503)
  }

  try {
    const authClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })
    const { data, error } = await authClient.auth.getUser(token)
    if (error || !data.user) return reply({ error: 'Invalid session.' }, 401)

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return reply({ error: 'An image file is required.' }, 400)
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      return reply({ error: 'Image must be between 1 byte and 5 MB.' }, 400)
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const detectedType = detectImage(bytes)
    if (!detectedType || detectedType !== file.type) {
      return reply({ error: 'Image content does not match an allowed JPEG, PNG, or WebP file.' }, 415)
    }

    const extension = detectedType === 'image/jpeg' ? 'jpg' : detectedType === 'image/png' ? 'png' : 'webp'
    const objectPath = `${data.user.id}/${randomUUID()}.${extension}`
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })
    const { error: uploadError } = await admin.storage
      .from('produce-listings')
      .upload(objectPath, bytes, {
        contentType: detectedType,
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Produce image upload failed:', uploadError)
      return reply({ error: 'Image upload failed. Please try again.' }, 500)
    }

    const { data: publicData } = admin.storage
      .from('produce-listings')
      .getPublicUrl(objectPath)

    return reply({ path: objectPath, publicUrl: publicData.publicUrl })
  } catch (error) {
    console.error('Produce image upload request failed:', error)
    return reply({ error: 'Unable to process image upload.' }, 500)
  }
}
