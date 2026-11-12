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
      <label className="block text-sm">
        Scanned quantity (expected {expectedQuantity})
        <input className="field mt-2" type="number" min="0" value={scanQuantity} onChange={event => setScanQuantity(event.target.value)} />
      </label>
      <div>
        <button type="button" className="ghost-btn" onClick={() => onScanComplete(Number(scanQuantity) === expectedQuantity)}>
          Check scanned quantity
        </button>
        <p className="mt-2 text-xs muted">Demo quantity check only; camera capture is not connected.</p>
      </div>
    </div>
  )
}