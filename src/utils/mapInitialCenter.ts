/** Default fallback when geolocation is unavailable (Rome). */
export const DEFAULT_MAP_CENTER: [number, number] = [12.4534, 41.9029]

export interface InitialMapLocation {
  center: [number, number]
  zoom: number
  lat: number
  lng: number
}

/** Resolves once with the user's current position, or null if denied / unsupported. */
export function getInitialMapLocation(
  timeoutMs = 8000,
  maximumAgeMs = 60_000
): Promise<InitialMapLocation | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      resolve(null)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lng = position.coords.longitude
        const lat = position.coords.latitude
        resolve({ center: [lng, lat], zoom: 15, lat, lng })
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: maximumAgeMs }
    )
  })
}
