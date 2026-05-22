import { useEffect, useState } from 'react'

export interface GeolocationPosition {
  lat: number
  lng: number
  heading: number | null
  accuracy: number | null
}

const UNSUPPORTED_MESSAGE = 'Location is not available on this device.'

export function useGeolocationWatch(enabled = true) {
  const [position, setPosition] = useState<GeolocationPosition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator

  useEffect(() => {
    if (!enabled || !supported) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setError(null)
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
          accuracy: pos.coords.accuracy,
        })
      },
      (err) => setError(err.message || 'Unable to read your location.'),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [enabled, supported])

  const displayError =
    error ?? (!supported && enabled ? UNSUPPORTED_MESSAGE : null)

  return { position, error: displayError, supported }
}
