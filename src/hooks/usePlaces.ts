import { useEffect, useState, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { fetchPlacesInBBox } from '../services/placesService';
import type { Place } from '../services/placesService';
import { getCached, setCache } from '../services/placesCache';

export function usePlaces(map: maplibregl.Map | null, kind: string = 'interesting_places,foods,amusements,sport,accomodations,tourist_facilities') {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePlaces = useCallback(async () => {
    if (!map) return;
    
    const zoom = map.getZoom();
    setZoomLevel(zoom);
    
    if (zoom < 12) {
      setPlaces([]);
      return;
    }

    const bounds = map.getBounds();
    const lonMin = Number(bounds.getWest().toFixed(4));
    const latMin = Number(bounds.getSouth().toFixed(4));
    const lonMax = Number(bounds.getEast().toFixed(4));
    const latMax = Number(bounds.getNorth().toFixed(4));
    const bboxKey = `${lonMin},${latMin},${lonMax},${latMax}_${kind}`;

    setLoading(true);
    setError(null);

    try {
      const cached = await getCached(bboxKey);
      if (cached) {
        setPlaces(cached);
        setLoading(false);
        return;
      }

      const data = await fetchPlacesInBBox(lonMin, latMin, lonMax, latMax, kind);
      await setCache(bboxKey, data);
      setPlaces(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load places');
    } finally {
      setLoading(false);
    }
  }, [map, kind]);

  useEffect(() => {
    if (!map) return;

    const onMoveEnd = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(updatePlaces, 500);
    };

    map.on('moveend', onMoveEnd);
    map.on('zoomend', onMoveEnd);

    // Initial check
    updatePlaces();

    return () => {
      map.off('moveend', onMoveEnd);
      map.off('zoomend', onMoveEnd);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [map, updatePlaces]);

  return { places, loading, error, zoomLevel };
}
