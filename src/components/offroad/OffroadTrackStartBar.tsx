import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { FiMapPin, FiNavigation } from 'react-icons/fi'
import type { OffroadRoute } from '../../types/models'
import { useGeolocationWatch } from '../../hooks/useGeolocationWatch'
import {
  OFFROAD_TRACK_START_PROXIMITY_M,
  canStartOffroadTrack,
  distanceToTrackMeters,
  hasNavigableTrack,
} from '../../utils/trackProximity'

interface OffroadTrackStartBarProps {
  tripId: string
  route: OffroadRoute
  compact?: boolean
}

export function OffroadTrackStartBar({ tripId, route, compact = false }: OffroadTrackStartBarProps) {
  const navigate = useNavigate()
  const navigable = hasNavigableTrack(route.trackGeoJson)
  const { position, error, supported } = useGeolocationWatch(navigable)

  const distanceM = useMemo(() => {
    if (!position || !navigable) return null
    return distanceToTrackMeters(position.lat, position.lng, route.trackGeoJson)
  }, [position, navigable, route.trackGeoJson])

  const canStart = useMemo(() => {
    if (!position || !navigable) return false
    return canStartOffroadTrack(position.lat, position.lng, route.trackGeoJson)
  }, [position, navigable, route.trackGeoJson])

  if (!navigable) {
    return (
      <Bar $compact={compact}>
        <HintText>Add a GPX track or draw at least two points before you can navigate this route.</HintText>
      </Bar>
    )
  }

  const startNavigation = () => {
    navigate(`/offroad-navigation/${tripId}/${route.id}`)
  }

  return (
    <Bar $compact={compact}>
      {!supported ? (
        <HintText>Enable location access to start track navigation.</HintText>
      ) : error ? (
        <HintText>{error}</HintText>
      ) : distanceM == null ? (
        <HintText>
          <FiMapPin aria-hidden /> Locating you…
        </HintText>
      ) : canStart ? (
        <>
          <HintText $accent>
            <FiMapPin aria-hidden /> You are on the trail ({Math.round(distanceM)} m away)
          </HintText>
          <StartBtn type="button" onClick={startNavigation}>
            <FiNavigation aria-hidden /> Start track
          </StartBtn>
        </>
      ) : (
        <>
          <HintText>
            <FiMapPin aria-hidden /> {Math.round(distanceM)} m from trail — move within{' '}
            {OFFROAD_TRACK_START_PROXIMITY_M} m to start
          </HintText>
          <StartBtn type="button" disabled>
            <FiNavigation aria-hidden /> Start track
          </StartBtn>
        </>
      )}
    </Bar>
  )
}

const Bar = styled.div<{ $compact?: boolean }>`
  display: flex;
  flex-direction: ${({ $compact }) => ($compact ? 'row' : 'column')};
  align-items: ${({ $compact }) => ($compact ? 'center' : 'stretch')};
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md};
  background: rgba(201, 162, 39, 0.08);
  border: 1px solid ${({ theme }) => theme.colors.offroad.line};
  border-radius: ${({ theme }) => theme.radii.lg};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex-direction: column;
    align-items: stretch;
  }
`

const HintText = styled.p<{ $accent?: boolean }>`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  color: ${({ $accent, theme }) => ($accent ? theme.colors.offroad.accent : theme.colors.text[380])};
  line-height: 1.4;
`

const StartBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 700;
  border: none;
  border-radius: ${({ theme }) => theme.radii.lg};
  padding: 0.65rem 1.25rem;
  min-height: 44px;
  cursor: pointer;
  white-space: nowrap;
  background: linear-gradient(140deg, ${({ theme }) => theme.colors.offroad.accent}, #a8841f);
  color: #1a1408;
  box-shadow: 0 4px 20px rgba(201, 162, 39, 0.35);
  transition: transform 0.15s ease, opacity 0.15s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`
