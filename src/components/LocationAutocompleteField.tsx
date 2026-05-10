import { useEffect, useState } from 'react'
import axios from 'axios'
import { FiMapPin } from 'react-icons/fi'
import api from '../data/api'

interface LocationSelection {
  name: string
  placeName: string
  lng: number
  lat: number
}

interface LocationSuggestion extends LocationSelection {
  id: string
}

interface LocationAutocompleteFieldProps {
  id: string
  label: string
  placeholder: string
  value: string
  onValueChange: (value: string) => void
  onLocationSelect: (selection: LocationSelection) => void
}

const nominatimCache: Record<string, LocationSuggestion[]> = {}

export function LocationAutocompleteField({ id, label, placeholder, value, onValueChange, onLocationSelect }: LocationAutocompleteFieldProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])

  useEffect(() => {
    const trimmed = value.trim()
    if (trimmed.length < 3) {
      setSuggestions([])
      return
    }

    if (nominatimCache[trimmed]) {
      setSuggestions(nominatimCache[trimmed])
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const res = await api.get('/api/geocoding/search', {
          params: { query: trimmed, limit: 6 },
          signal: controller.signal
        })
        const results = res.data as LocationSuggestion[]
        
        nominatimCache[trimmed] = results
        setSuggestions(results)
      } catch (err: any) {
        if (!axios.isCancel(err)) {
          console.error('Location search failed:', err)
        }
      } finally {
        setIsLoading(false)
      }
    }, 600)
    
    return () => { clearTimeout(timer); controller.abort() }
  }, [value])

  return (
    <div className="form-group" style={{ position: 'relative' }}>
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="location-input-shell" style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0 1rem' }}>
        <FiMapPin style={{ opacity: 0.4 }} />
        <input id={id} className="input" style={{ border: 'none', background: 'transparent' }} value={value} onChange={e => onValueChange(e.target.value)} onFocus={() => setIsFocused(true)} onBlur={() => setTimeout(() => setIsFocused(false), 200)} placeholder={placeholder} />
      </div>
      {isFocused && (suggestions.length > 0 || isLoading) && (
        <div className="location-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--bg-900)', border: '1px solid rgba(154,198,148,0.1)', borderRadius: '12px', marginTop: '0.5rem', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.4)' }}>
           {isLoading && <p style={{ padding: '1rem', fontSize: '0.8rem', opacity: 0.5 }}>Querying locations...</p>}
           {suggestions.map(s => (
             <button key={s.id} type="button" className="location-option" style={{ width: '100%', textAlign: 'left', padding: '1rem', border: 'none', background: 'transparent', cursor: 'pointer' }} onMouseDown={() => onLocationSelect(s)}>
                <div style={{ fontWeight: 600, color: 'var(--text-100)' }}>{s.name}</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{s.placeName}</div>
             </button>
           ))}
        </div>
      )}
    </div>
  )
}
