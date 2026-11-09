'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { createClient, type Listing } from '../lib/supabase'
import { formatPrice } from '../lib/priceRules'

const categories = ['Mushroom', 'Potatoes', 'Onions', 'Kales', 'Cabbage', 'Cereals', 'Beef']
const locations = ['Kericho', 'Nakuru', 'Eldoret', 'Nairobi', 'Kisumu', 'Mombasa', 'Kisii']

function detect(value: string) {
  const text = value.toLowerCase()
  if (/sukuma|kale/.test(text)) return 'Kales'
  if (/viazi|potato/.test(text)) return 'Potatoes'
  if (/kitunguu|onion/.test(text)) return 'Onions'
  if (text.includes('cabbage')) return 'Cabbage'
  if (/mushroom|oyster|button/.test(text)) return 'Mushroom'
  if (text.includes('beef')) return 'Beef'
  if (/maize|beans|rice/.test(text)) return 'Cereals'
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
  const [product, setProduct] = useState(initialProduct)
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [location, setLocation] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setProduct(initialProduct)
      setCategory(detect(initialProduct))
      setError('')
    }
  }, [open, initialProduct])

  const detected = useMemo(() => detect(product), [product])
  const total = Number(price || 0) * Number(quantity || 0)

  if (!open) return null

  async function publish(event: FormEvent) {
    event.preventDefault()
    const clean = product.trim()
    const finalCategory = category || detected
    const numericPrice = Number(price)
    const numericQuantity = Number(quantity)

    if (!userId) {
      onNeedAuth()
      return
    }
    if (!clean || !finalCategory || !location) {
      setError('Complete the product, category, and location.')
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

      const uploadForm = new FormData()
      uploadForm.append('file', photo)
      const uploadResponse = await fetch('/api/listings/photo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: uploadForm,
      })
      const uploadResult = await uploadResponse.json().catch(() => ({}))
      if (!uploadResponse.ok || typeof uploadResult.path !== 'string' || typeof uploadResult.publicUrl !== 'string') {
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
          price: numericPrice,
          quantity: numericQuantity,
          photo_url: uploadResult.publicUrl,
        })
        .select()
        .single()

      if (insertError) throw new Error(insertError.message)
      if (!data) throw new Error('The listing was not saved.')

      onCreated(data as Listing)
      setPhoto(null)
      setProduct('')
      setCategory('')
      setPrice('')
      setQuantity('')
      setLocation('')
      onClose()
    } catch (cause) {
      if (uploadedPath) {
        try {
          await createClient().storage.from('produce-listings').remove([uploadedPath])
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
          <input className="field min-h-11" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setPhoto(event.target.files?.[0] || null)} aria-label="Photo" required/>
          <input className="field min-h-11" value={product} onChange={event => setProduct(event.target.value)} placeholder="e.g. Sukuma Wiki, Viazi, Kitunguu..." aria-label="Product" required/>
          <select className="field min-h-11" value={category} onChange={event => setCategory(event.target.value)} required>
            <option value="">Category</option>
            {categories.map(item => <option key={item}>{item}</option>)}
          </select>
          {detected && detected !== category && <p className="text-xs gold">Suggested category: {detected}</p>}
          <input className="field min-h-11" type="number" min="0.01" step="0.01" value={price} onChange={event => setPrice(event.target.value)} placeholder="Price per kg KES e.g. 50" aria-label="Price per kg KES" required/>
          <input className="field min-h-11" type="number" min="0.01" step="0.01" value={quantity} onChange={event => setQuantity(event.target.value)} placeholder="Quantity kg e.g. 20" aria-label="Quantity kg" required/>
          <select className="field min-h-11" value={location} onChange={event => setLocation(event.target.value)} required>
            <option value="">Location</option>
            {locations.map(item => <option key={item}>{item}</option>)}
          </select>

          {product && quantity && price && location && (
            <div className="rounded-xl bg-[#ffd60a]/10 p-3 text-sm">
              {quantity} kg of {product} at {formatPrice(numericSafe(price), 'KES')}/kg in {location} = {total.toLocaleString()} KES.
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
