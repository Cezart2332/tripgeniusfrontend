import { useEffect, useRef, useState } from 'react'
import type maplibregl from 'maplibre-gl'
import { prefetchViewport } from '../utils/mapTileCache'

export interface UseMapTilePrefetchOptions {
  enabled?: boolean
  debounceMs?: number
}

export function useMapTilePrefetch(
  map: maplibregl.Map | null,
  options: UseMapTilePrefetchOptions = {},
) {
  const { enabled = true, debounceMs = 500 } = options
  const [isPrefetching, setIsPrefetching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const idleIdRef = useRef<number | ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!map || !enabled) return

    const schedulePrefetch = () => {
      if (!navigator.onLine) return

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const run = async () => {
          abortRef.current?.abort()
          abortRef.current = new AbortController()
          setIsPrefetching(true)
          try {
            await prefetchViewport(map, { signal: abortRef.current.signal })
          } finally {
            setIsPrefetching(false)
          }
        }

        if (typeof requestIdleCallback !== 'undefined') {
          idleIdRef.current = requestIdleCallback(() => void run(), { timeout: 3000 })
        } else {
          idleIdRef.current = setTimeout(() => void run(), 0)
        }
      }, debounceMs)
    }

    map.on('moveend', schedulePrefetch)
    map.on('zoomend', schedulePrefetch)

    return () => {
      map.off('moveend', schedulePrefetch)
      map.off('zoomend', schedulePrefetch)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (idleIdRef.current !== null) {
        if (typeof cancelIdleCallback !== 'undefined' && typeof idleIdRef.current === 'number') {
          cancelIdleCallback(idleIdRef.current)
        } else {
          clearTimeout(idleIdRef.current as ReturnType<typeof setTimeout>)
        }
      }
      abortRef.current?.abort()
    }
  }, [map, enabled, debounceMs])

  return { isPrefetching }
}
