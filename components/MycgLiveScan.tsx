'use client'

import { useState } from 'react'

type Location = { lat: number; lng: number }

export function MycgLiveScan({
  expectedQuantity,
  onScanComplete,
  onLocationChange,
}: {
  expectedQuantity: number
  onScanComplete: (passed: boolean) => void
  onLocationChange?: (location: Location | null) => void
}) {
  const [enabled, setEnabled] = useState(false)
  const [error, setError] = useState('')
  const [scanQuantity, setScanQuantity] = useState(String(expectedQuantity))
  const [photoName, setPhotoName] = useState('')

  function toggleLocation(checked: boolean) {
    setError('')
    setEnabled(checked)
    if (!checked) { onLocationChange?.(null); return }
    if (!navigator.geolocation) { setEnabled(false); setError('Location is unavailable in this browser.'); return }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => onLocationChange?.({ lat: coords.latitude, lng: coords.longitude }),
      () => { setEnabled(false); onLocationChange?.(null); setError('Location permission was not granted.') },
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm">
          <input type="checkbox" checked={enabled} onChange={event => toggleLocation(event.target.checked)} />
          {' '}Enable Location Viewing for this order
        </label>
        {enabled && <p className="mt-2 text-sm muted">Location: Enabled - lat/lng will be sent with scan</p>}
        {error && <p className="mt-2 text-sm text-red-400" role="status">{error}</p>}
      </div>
      <form onSubmit={event => { event.preventDefault(); onScanComplete(Number(scanQuantity) === expectedQuantity) }}>
        <label className="block text-sm">Live scan photo
          <input
            className="field mt-2"
            type="file"
            accept="image/*"
            capture="environment"
            required
            onChange={event => setPhotoName(event.currentTarget.files?.[0]?.name ?? '')}
          />
        </label>
        {photoName && <p className="mt-2 text-xs muted">Selected: {photoName}</p>}
        <label className="mt-4 block text-sm">
          Scanned quantity (expected {expectedQuantity})
          <input className="field mt-2" type="number" min="0" value={scanQuantity} onChange={event => setScanQuantity(event.target.value)} />
        </label>
        <button type="submit" className="ghost-btn mt-4">Check scanned quantity</button>
        <p className="mt-2 text-xs muted">Demo quantity check only; photo is not uploaded or verified.</p>
      </form>
    </div>
  )
}