'use client'

import { useState } from 'react'

type Location = { lat: number; lng: number }

export function MycgLiveScan({ onLocationChange }: { onLocationChange?: (location: Location | null) => void }) {
  const [enabled, setEnabled] = useState(false)
  const [error, setError] = useState('')

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
    <div>
      <label>
        <input type="checkbox" checked={enabled} onChange={event => toggleLocation(event.target.checked)} />
        {' '}Enable Location Viewing for this order
      </label>
      {enabled && <p>Location: Enabled - lat/lng will be sent with scan</p>}
      {error && <p role="status">{error}</p>}
    </div>
  )
}