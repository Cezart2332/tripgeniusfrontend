import { useEffect, useState } from 'react'
import axios from 'axios'
import { FiMapPin, FiNavigation } from 'react-icons/fi'
import api from '../data/api'
import styled from 'styled-components'

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

const FormGroup = styled.div`
  position: relative;
`

const FieldLabel = styled.label`
  display: block;
  font-size: ${({ theme }) => theme.typography.caption};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text[380]};
  margin-bottom: 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`

const InputShell = styled.div`
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  border-radius: 12px;
  padding: 0 1rem;
  transition: border-color 0.2s ease;

  &:focus-within {
    border-color: ${({ theme }) => theme.colors.green[580]};
    box-shadow: 0 0 0 3px rgba(23, 247, 2, 0.06);
  }
`

const StyledInput = styled.input`
  flex: 1;
  padding: 0.65rem 0.5rem;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.body};
  font-family: inherit;
  outline: none;
  min-height: 44px;

  &::placeholder {
    color: ${({ theme }) => theme.colors.text[500]};
  }
`

const MapPinIcon = styled(FiMapPin)`
  opacity: 0.4;
  color: ${({ theme }) => theme.colors.text[380]};
  flex-shrink: 0;
`

const LocateButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.green[500]};
  cursor: pointer;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  border-radius: ${({ theme }) => theme.radii.full};
  transition: all 0.15s ease;

  &:hover {
    background: rgba(23, 247, 2, 0.08);
  }
`

const Dropdown = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 10;
  background: ${({ theme }) => theme.colors.surface[900]};
  border: 1px solid rgba(154, 198, 148, 0.1);
  border-radius: 12px;
  margin-top: 0.5rem;
  overflow: hidden;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
`

const LoadingHint = styled.p`
  padding: 1rem;
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.text[500]};
`

const OptionButton = styled.button`
  width: 100%;
  text-align: left;
  padding: 1rem;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.text[100]};
  cursor: pointer;
  transition: background 0.1s ease;

  &:hover {
    background: rgba(23, 247, 2, 0.06);
  }

  &:not(:last-child) {
    border-bottom: 1px solid rgba(154, 198, 148, 0.05);
  }
`

const OptionName = styled.div`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
`

const OptionPlace = styled.div`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.text[500]};
  margin-top: 0.15rem;
`

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
      } catch (err: unknown) {
        if (!axios.isCancel(err)) {
          console.error('Location search failed:', err)
        }
      } finally {
        setIsLoading(false)
      }
    }, 600)
    
    return () => { clearTimeout(timer); controller.abort() }
  }, [value])

  const useMyLocation = () => {
    setIsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
          const data = await res.json()
          
          if (data) {
            const name = data.name || data.display_name.split(',')[0]
            const selection: LocationSelection = {
              name: name,
              placeName: data.display_name,
              lat: latitude,
              lng: longitude
            }
            onLocationSelect(selection)
            onValueChange(selection.placeName)
          }
        } catch (err) {
          console.error('Reverse geocoding failed:', err)
        } finally {
          setIsLoading(false)
        }
      },
      (err) => {
        console.error('Geolocation failed:', err)
        setIsLoading(false)
      }
    )
  }

  return (
    <FormGroup>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputShell>
        <MapPinIcon />
        <StyledInput id={id} value={value} onChange={e => onValueChange(e.target.value)} onFocus={() => setIsFocused(true)} onBlur={() => setTimeout(() => setIsFocused(false), 200)} placeholder={placeholder} />
        <LocateButton
          type="button"
          onClick={useMyLocation}
          title="Use my current location"
        >
          <FiNavigation size={18} />
        </LocateButton>
      </InputShell>
      {isFocused && (suggestions.length > 0 || isLoading) && (
        <Dropdown>
           {isLoading && <LoadingHint>Querying locations...</LoadingHint>}
           {suggestions.map(s => (
             <OptionButton key={s.id} type="button" onMouseDown={() => onLocationSelect(s)}>
                <OptionName>{s.name}</OptionName>
                <OptionPlace>{s.placeName}</OptionPlace>
             </OptionButton>
           ))}
        </Dropdown>
      )}
    </FormGroup>
  )
}
