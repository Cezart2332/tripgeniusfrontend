import type { TripStatus } from '../types/models'

export type BackendTripStatus = 'Upcoming' | 'Started' | 'Finished'

export const normalizeTripStatus = (status: unknown): BackendTripStatus | null => {
  if (typeof status !== 'string') {
    return null
  }

  const normalized = status.trim().toLowerCase()

  if (normalized === 'upcoming') {
    return 'Upcoming'
  }

  if (normalized === 'started' || normalized === 'active') {
    return 'Started'
  }

  if (normalized === 'finished' || normalized === 'completed') {
    return 'Finished'
  }

  return null
}

export const isUpcomingTripStatus = (status: TripStatus | string): boolean =>
  normalizeTripStatus(status) === 'Upcoming'

export const isStartedTripStatus = (status: TripStatus | string): boolean =>
  normalizeTripStatus(status) === 'Started'

export const isFinishedTripStatus = (status: TripStatus | string): boolean =>
  normalizeTripStatus(status) === 'Finished'

export const getTripStatusLabel = (status: TripStatus | string): string =>
  normalizeTripStatus(status) ?? String(status)
