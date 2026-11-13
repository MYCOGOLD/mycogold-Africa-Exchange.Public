'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { createClient, type Listing } from '../lib/supabase'
import { formatPrice } from '../lib/priceRules'

const categories = ['Mushroom', 'Potatoes', 'Onions', 'Kales', 'Cabbage', 'Cereals', 'Beef', 'Tomato', 'Carrot', 'Spinach']

function detect(value: string) {
  const text = value.toLowerCase()
  if (/sukuma|kale/.test(text)) return 'Kales'
  if (/viazi|potato/.test(text)) return 'Potatoes'
  if (/kitunguu|onion/.test(text)) return 'Onions'
  if (text.includes('cabbage')) return 'Cabbage'
  if (/mushroom|oyster|button/.test(text)) return 'Mushroom'
  if (text.includes('beef')) return 'Beef'
  if (/maize|beans|rice/.test(text)) return 'Cereals'
  if (text.includes('tomato')) return 'Tomato'
  if (text.includes('carrot')) return 'Carrot'
  if (text.includes('spinach')) return 'Spinach'
  return ''
}

export function AddProduceModal({
  open,
  onClose,
  onCreated,
  userId,
  initialProduct = '',
  onNeedAuth,
}: {
  open: boolean
  onClose: () => void
  onCreated: (listing: Listing) => void
  userId: string | null
  userName: string
  initialProduct?: string
  onNeedAuth: () => void
}) {
  const [photo, setPhoto] = useState<File | null>(null)
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const [category, setCategory] = useState('')
  const [varieties, setVarieties] = useState<string[]>([])
  const [variety, setVariety] = useState('')
  const [customVariety, setCustomVariety] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [location, setLocation] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setCategory(detect(initialProduct))
      setVariety(initialProduct ? '__CUSTOM__' : '')
      setCustomVariety(initialProduct)
      setError('')
    }
  }, [open, initialProduct])

  useEffect(() => {
    if (!open) return
    let active = true
    setLocation('')
    setLatitude(null)
    setLongitude(null)

    if (!navigator.geolocation) {
      setError('Enable GPS to post')
      return
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        if (!active) return
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setLatitude(lat)
        setLongitude(lng)
        setLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
        setError('')
      },
      () => {
        if (!active) return
        setLatitude(null)
        setLongitude(null)
        setLocation('')
          setError('Enable GPS to post')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )

    return () => { active = false }
  }, [open])

  useEffect(() => {
    const input = photoInputRef.current
    if (!open || !input) return

    const handleCancel = () => {
      input.value = ''
      setPhoto(null)
      setError('Camera capture was cancelled. A new photo is required.')
    }

    input.addEventListener('cancel', handleCancel)
    return () => input.removeEventListener('cancel', handleCancel)
  }, [open])

  useEffect(() => {
    if (!open || !category) {
      setVarieties([])
      return
    }
    let active = true
    createClient()
      .from('product_catalog')
      .select('variety')
      .eq('category', category)
      .order('variety')
      .then(({ data, error: catalogError }) => {
        if (!active) return
        if (catalogError) {
          setError(`Could not load ${category.toLowerCase()} varieties. Please try again.`)
          return
        }
        setVarieties((data || []).map(item => item.variety))
      })
    return () => { active = false }
  }, [open, category])

  const detected = useMemo(() => detect(initialProduct), [initialProduct])
  const total = Number(price || 0) * Number(quantity || 0)
  const displayProduct = variety === '__CUSTOM__' ? customVariety : variety

  if (!open) return null

  async function publish(event: FormEvent) {
    event.preventDefault()
    const finalVariety = variety === '__CUSTOM__' ? customVariety.trim() : variety
    const clean = finalVariety
    const finalCategory = category || detected
    const numericPrice = Number(price)
    const numericQuantity = Number(quantity)

    if (!userId) {
      onNeedAuth()
      return
    }
    if (latitude === null || longitude === null) {
      setError('Enable GPS to post')
      return
    }
    if (!clean || !finalCategory || !location) {
      setError('Select or enter a product variety, category, and location.')
      return
    }
    if (clean.length > 80) {
      setError('Product variety must be 80 characters or fewer.')
      return
    }
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setError('Enter a valid price greater than zero.')
      return
    }
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      setError('Enter a valid quantity greater than zero.')
      return
    }
    if (!photo) {
      setError('A listing photo is required.')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type) || photo.size > 4 * 1024 * 1024) {
      setError('Use a JPEG, PNG, or WebP image up to 4 MB.')
      return
    }

    setLoading(true)
    setError('')
    let uploadedPath: string | null = null

    try {
      const supabase = createClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (sessionError || authError || !session || !user || user.id !== userId) {
        throw new Error('Your session is no longer valid. Sign in again.')
      }

      if (variety === '__CUSTOM__') {
        const { error: catalogError } = await supabase
          .from('product_catalog')
          .upsert(
            { category, variety: finalVariety, created_by: user.id },
            { onConflict: 'category,variety', ignoreDuplicates: true },
          )
        if (catalogError) throw new Error(`Could not save mushroom variety: ${catalogError.message}`)
      }

      const uploadForm = new FormData()
      uploadForm.append('file', photo)
      const uploadResponse = await fetch('/api/listings/photo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: uploadForm,
      })
      const uploadResult = await uploadResponse.json().catch(() => ({}))
      if (!uploadResponse.ok || typeof uploadResult.path !== 'string') {
        throw new Error(String(uploadResult.error || 'Secure photo upload failed.'))
      }
      uploadedPath = uploadResult.path

      const { data, error: insertError } = await supabase
        .from('listings')
        .insert({
          seller_id: user.id,
          category: finalCategory,
          product: clean,
          location,
          latitude,
          longitude,
          price: numericPrice,
          quantity: numericQuantity,
          photo_path: uploadResult.path,
          status: 'pending',
        })
        .select()
        .single()

      if (insertError) throw new Error(insertError.message)
      if (!data) throw new Error('The listing was not saved.')

      onCreated(data as Listing)
      setPhoto(null)
      setCategory('')
      setVariety('')
      setCustomVariety('')
      setPrice('')
      setQuantity('')
      setLocation('')
      onClose()
    } catch (cause) {
      if (uploadedPath) {
        try {
          await createClient().storage.from('listing-photos').remove([uploadedPath])
        } catch {
          // Cleanup is best-effort; the original submission error is shown below.
        }
      }
      setError(cause instanceof Error ? cause.message : 'Could not submit the listing.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="add-produce-title">
      <div className="glass w-full max-w-lg p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="mono text-[10px] uppercase tracking-[.25em] gold">ADD PRODUCE</p>
            <h2 id="add-produce-title" className="mt-1 text-xl font-bold">Submit listing for review</h2>
          </div>
          <button className="ghost-btn p-2" onClick={onClose} aria-label="Close" disabled={loading}>
            <X size={18}/>
          </button>
        </div>

        <form onSubmit={publish} className="mt-5 space-y-3">
          <input ref={photoInputRef} className="field min-h-11" type="file" accept="image/*" capture="environment" onChange={event => { const selectedPhoto = event.target.files?.[0] || null; setPhoto(selectedPhoto); setError(selectedPhoto ? '' : 'Camera capture was cancelled. A new photo is required.') }} aria-label="Camera photo" required/>
          <select className="field min-h-11" value={category} onChange={event => { setCategory(event.target.value); setVariety(''); setCustomVariety('') }} required>
            <option value="">Category</option>
            {categories.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="field min-h-11" value={variety} onChange={event => { setVariety(event.target.value); setCustomVariety('') }} required aria-label="Product variety" disabled={!category}>
            <option value="">{category ? `${category} variety` : 'Select a category first'}</option>
            {varieties.map(item => <option key={item} value={item}>{item}</option>)}
            <option value="__CUSTOM__">Add new variety...</option>
          </select>
          {variety === '__CUSTOM__' && (
            <input className="field min-h-11" value={customVariety} onChange={event => setCustomVariety(event.target.value)} placeholder="Enter product variety" aria-label="New product variety" maxLength={80} required/>
          )}
          {detected && detected !== category && <p className="text-xs gold">Suggested category: {detected}</p>}
          <input className="field min-h-11" type="number" min="0.01" step="0.01" value={price} onChange={event => setPrice(event.target.value)} placeholder="Price per kg KES e.g. 50" aria-label="Price per kg KES" required/>
          <input className="field min-h-11" type="number" min="0.01" step="0.01" value={quantity} onChange={event => setQuantity(event.target.value)} placeholder="Quantity kg e.g. 20" aria-label="Quantity kg" required/>
          <input className="field min-h-11" value={location} placeholder="Waiting for GPS location..." aria-label="Location" readOnly required/>

          {displayProduct && quantity && price && location && (
            <div className="rounded-xl bg-[#ffd60a]/10 p-3 text-sm">
              {quantity} kg of {displayProduct} at {formatPrice(numericSafe(price), 'KES')}/kg in {location} = {total.toLocaleString()} KES.
            </div>
          )}
          {error && <p className="text-sm text-[#ff7777]" role="alert">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className="ghost-btn min-h-11 flex-1" onClick={onClose} disabled={loading}>Cancel</button>
            <button className="gold-btn min-h-11 flex-1" disabled={loading}>
              {loading ? 'Submitting…' : 'Submit for review'}
            </button>
          </div>
          <p className="text-[11px] muted">Listings are not independently verified. Staff review is required before they become publicly visible.</p>
        </form>
      </div>
    </div>
  )
}

function numericSafe(value: string) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}
