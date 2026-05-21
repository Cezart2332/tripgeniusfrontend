import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react'
import { FiBell, FiChevronDown, FiCompass, FiMail, FiUploadCloud, FiZap, FiUser, FiUsers, FiCalendar, FiClock } from 'react-icons/fi'
import { useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components'

import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { tripTypeOptions } from '../data/tripTypeOptions'
import type { OffroadTrip, Trip, User } from '../types/models'
import api, { updateCachedResponse } from '../data/api'
import { setUser } from '../data/authSlice'
import { AxiosError } from 'axios'
import { isQueuedRequestError } from '../utils/errorMessage'
import { ToastContainer, useToast } from '../components/shared/Toast'
import waitForBackendButtonUnlock from '../utils/interactionDelay'
import { formatDisplayDate, formatDisplayDateRange } from '../utils/dateDisplay'
import {
  getTripStatusLabel,
  isFinishedTripStatus,
  isUpcomingTripStatus,
} from '../utils/tripStatus'
import { getAvatarUrl } from '../utils/userUtils'
import { EmptyState } from '../components/shared/EmptyState'
import { SkeletonCard } from '../components/shared/SkeletonCard'

interface AuthStoreState {
  auth: {
    user: User | null
    token: string | null
  }
}

type ProfileTab = 'identity' | 'invites' | 'history' | 'matches' | 'notifications'

type TripWithType = (Trip | OffroadTrip) & { tripType: 'classic' | 'offroad' }

interface PersonalizedTripCard {
  id: string
  title: string
  coverImage: string
  description: string
  status: string
  timelineLength: number
  startDate: string
  currentMembers: number
  maxMembers: number
  price: number
  tags: string[]
  matchScore: number
  matchReasons: string[]
}

const toggleTripType = (current: string[], type: string): string[] =>
  current.includes(type)
    ? current.filter((item) => item !== type)
    : [...current, type]

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

const revealTransition = {
  duration: 0.58,
  ease: [0.22, 1, 0.36, 1] as const,
}

const DEFAULT_PROFILE_DESCRIPTION = ''

const isActiveTrip = (trip: TripWithType): boolean => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startDate = new Date(trip.startingDate)
  startDate.setHours(0, 0, 0, 0)

  const endDate = new Date(trip.endingDate)
  endDate.setHours(0, 0, 0, 0)

  return startDate <= today && today <= endDate
}

const isUpcomingTrip = (trip: TripWithType): boolean => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startDate = new Date(trip.startingDate)
  startDate.setHours(0, 0, 0, 0)

  return startDate > today
}

const isPastTrip = (trip: TripWithType): boolean => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const endDate = new Date(trip.endingDate)
  endDate.setHours(0, 0, 0, 0)

  return endDate < today
}

const profileTabs: Array<{ key: ProfileTab; label: string; icon: React.ComponentType<{ className?: string; size?: number }> }> = [
  { key: 'identity', label: 'Identity', icon: FiUser },
  { key: 'invites', label: 'Invites', icon: FiMail },
  { key: 'history', label: 'History', icon: FiZap },
  { key: 'matches', label: 'Matches', icon: FiCompass },
  { key: 'notifications', label: 'Notifications', icon: FiBell },
]

const formatNotificationTimestamp = (notification: User['notifications'][number]): string => {
  const timestampValue =
    (notification as {
      CreatedAt?: string
      createdAt?: string
      date?: string
      timestamp?: string
      Timestamp?: string
      created?: string
    }).CreatedAt ??
    (notification as {
      CreatedAt?: string
      createdAt?: string
      date?: string
      timestamp?: string
      Timestamp?: string
      created?: string
    }).createdAt ??
    (notification as {
      CreatedAt?: string
      createdAt?: string
      date?: string
      timestamp?: string
      Timestamp?: string
      created?: string
    }).timestamp ??
    (notification as {
      CreatedAt?: string
      createdAt?: string
      date?: string
      timestamp?: string
      Timestamp?: string
      created?: string
    }).Timestamp ??
    (notification as {
      CreatedAt?: string
      createdAt?: string
      date?: string
      timestamp?: string
      Timestamp?: string
      created?: string
    }).created ??
    notification.date

  if (!timestampValue) {
    return 'Just now'
  }

  const dotNetDateMatch = /\/Date\((\d+)\)\//.exec(timestampValue)
  const parsedDate = dotNetDateMatch
    ? new Date(Number(dotNetDateMatch[1]))
    : new Date(timestampValue)

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Just now'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsedDate)
}

const isNotificationRead = (
  notification: User['notifications'][number],
  readNotificationIds: number[],
): boolean => {
  const backendReadStatus =
    notification.isRead ??
    notification.read ??
    notification.IsRead ??
    notification.Read ??
    false

  return backendReadStatus || readNotificationIds.includes(notification.id)
}

const getErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof AxiosError) {
    const responseData = error.response?.data

    if (typeof responseData === 'string') {
      return responseData
    }

    if (responseData && typeof responseData === 'object') {
      const messageValue =
        (responseData as { message?: unknown }).message ??
        (responseData as { error?: unknown }).error ??
        (responseData as { detail?: unknown }).detail

      if (typeof messageValue === 'string') {
        return messageValue
      }

      if (messageValue != null) {
        return String(messageValue)
      }

      return JSON.stringify(responseData)
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallbackMessage
}

const Page = styled.section`
  width: min(1200px, 100% - 2rem);
  margin: 0 auto;
  padding-top: ${({ theme }) => theme.spacing.lg};
  padding-bottom: ${({ theme }) => theme.spacing['3xl']};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: min(1200px, 100% - 1rem);
    padding-bottom: 7rem;
    gap: ${({ theme }) => theme.spacing.md};
  }
`

const UnauthedWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: ${({ theme }) => theme.spacing['3xl']} ${({ theme }) => theme.spacing.lg};
  gap: ${({ theme }) => theme.spacing.md};
`

const UnauthedSticker = styled.img`
  width: 160px;
  height: auto;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
  opacity: 0.85;
`

const UnauthedTitle = styled.h1`
  font-size: ${({ theme }) => theme.typography.h1};
  color: ${({ theme }) => theme.colors.text[100]};
`

const UnauthedDesc = styled.p`
  font-size: ${({ theme }) => theme.typography.lead};
  color: ${({ theme }) => theme.colors.text[380]};
  max-width: 440px;
`

const UnauthedLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.pill};
  transition: all ${({ theme }) => theme.animation.duration.normal}s;
  min-height: 44px;
  min-width: 44px;
  white-space: nowrap;
  text-decoration: none;
  line-height: 1;
  padding: 0.65rem 1.5rem;
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: #0a1e08;
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};

  &:hover {
    background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[500]}, ${({ theme }) => theme.colors.green[300]});
    transform: translateY(-1px);
    box-shadow: 0 0 40px rgba(23, 247, 2, 0.3), 0 0 80px rgba(23, 247, 2, 0.1);
  }
`

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.lg};
  flex-wrap: wrap;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex-direction: column;
    align-items: flex-start;
  }
`

const HeaderText = styled.div``

const HeaderTitle = styled.h1`
  font-size: ${({ theme }) => theme.typography.h1};
  color: ${({ theme }) => theme.colors.text[100]};
`

const Eyebrow = styled.p`
  font-size: ${({ theme }) => theme.typography.eyebrow};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.colors.green[580]};
  margin-bottom: 0.15rem;
`

const TabList = styled.nav`
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineSoft};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }
`

const Tab = styled.button<{ $active: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.7rem 1rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  color: ${({ $active, theme }) => ($active ? theme.colors.text[100] : theme.colors.text[380])};
  background: transparent;
  border: none;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.2s ease;
  min-height: 40px;
  font-family: inherit;

  &:hover {
    color: ${({ theme }) => theme.colors.text[220]};
  }
`

const TabActiveBar = styled(motion.div)`
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
`

const TabIconMobile = styled.span`
  @media (min-width: calc(${({ theme }) => theme.breakpoints.mobile} + 1px)) {
    display: none;
  }
`

const TabLabelDesktop = styled.span`
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    display: none;
  }
`

const Panel = styled(motion.div)``

const Section = styled.div`
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  -webkit-backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  padding: ${({ theme }) => theme.spacing.xl};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: ${({ theme }) => theme.spacing.lg};
  }
`

const SectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.h3};
  color: ${({ theme }) => theme.colors.text[100]};
`

const SectionDesc = styled.p`
  font-size: ${({ theme }) => theme.typography.body};
  color: ${({ theme }) => theme.colors.text[380]};
  line-height: 1.5;
`

const FieldLabel = styled.label`
  font-size: ${({ theme }) => theme.typography.eyebrow};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.text[500]};
  display: block;
`

const Input = styled.input`
  width: 100%;
  padding: 0.7rem 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: ${({ theme }) => theme.colors.bg[940]};
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.body};
  font-family: inherit;
  transition: border-color 0.15s ease;
  min-height: 44px;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.green[500]};
    box-shadow: 0 0 0 3px rgba(23, 247, 2, 0.1);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const TextArea = styled.textarea`
  width: 100%;
  padding: 0.7rem 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: ${({ theme }) => theme.colors.bg[940]};
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.body};
  font-family: inherit;
  transition: border-color 0.15s ease;
  resize: vertical;
  min-height: 44px;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.green[500]};
    box-shadow: 0 0 0 3px rgba(23, 247, 2, 0.1);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const PrimaryBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  font-family: inherit;
  border-radius: ${({ theme }) => theme.radii.pill};
  transition: all ${({ theme }) => theme.animation.duration.normal}s;
  min-height: 44px;
  min-width: 44px;
  white-space: nowrap;
  line-height: 1;
  padding: 0.65rem 1.5rem;
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: #0a1e08;
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};
  border: none;
  cursor: pointer;
  align-self: flex-start;

  &:hover {
    background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[500]}, ${({ theme }) => theme.colors.green[300]});
    transform: translateY(-1px);
    box-shadow: 0 0 40px rgba(23, 247, 2, 0.3), 0 0 80px rgba(23, 247, 2, 0.1);
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`

const SmallPrimaryBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  font-family: inherit;
  border-radius: ${({ theme }) => theme.radii.pill};
  transition: all ${({ theme }) => theme.animation.duration.normal}s;
  min-height: 36px;
  min-width: 36px;
  white-space: nowrap;
  line-height: 1;
  padding: 0.4rem 0.9rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: #0a1e08;
  border: none;
  cursor: pointer;

  &:hover {
    background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[500]}, ${({ theme }) => theme.colors.green[300]});
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const GhostBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  font-family: inherit;
  border-radius: ${({ theme }) => theme.radii.pill};
  transition: all ${({ theme }) => theme.animation.duration.normal}s;
  min-height: 36px;
  min-width: 36px;
  white-space: nowrap;
  line-height: 1;
  padding: 0.4rem 0.9rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  background: transparent;
  color: ${({ theme }) => theme.colors.green[580]};
  border: 1px solid rgba(154, 198, 148, 0.2);
  cursor: pointer;

  &:hover {
    background: rgba(65, 162, 56, 0.08);
    border-color: ${({ theme }) => theme.colors.line};
    color: ${({ theme }) => theme.colors.green[500]};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const GhostLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.pill};
  transition: all ${({ theme }) => theme.animation.duration.normal}s;
  min-height: 36px;
  min-width: 36px;
  white-space: nowrap;
  text-decoration: none;
  line-height: 1;
  padding: 0.4rem 0.9rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  background: transparent;
  color: ${({ theme }) => theme.colors.green[580]};
  border: 1px solid rgba(154, 198, 148, 0.2);

  &:hover {
    background: rgba(65, 162, 56, 0.08);
    border-color: ${({ theme }) => theme.colors.line};
    color: ${({ theme }) => theme.colors.green[500]};
  }
`

const DiscoverLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.pill};
  transition: all ${({ theme }) => theme.animation.duration.normal}s;
  min-height: 36px;
  min-width: 36px;
  white-space: nowrap;
  text-decoration: none;
  line-height: 1;
  margin-top: 0.5rem;
  padding: 0.4rem 0.9rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: #0a1e08;
  border: none;
  cursor: pointer;

  &:hover {
    background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[500]}, ${({ theme }) => theme.colors.green[300]});
  }
`

const IdentityLayout = styled(motion.div)`
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: ${({ theme }) => theme.spacing.xl};
  align-items: flex-start;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
  }
`

const AvatarSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.xl};
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  -webkit-backdrop-filter: blur(${({ theme }) => theme.glass.blur});

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: ${({ theme }) => theme.spacing.lg};
  }
`

const AvatarWrapper = styled.label`
  position: relative;
  width: 140px;
  height: 140px;
  border-radius: ${({ theme }) => theme.radii.full};
  overflow: hidden;
  cursor: pointer;
  border: 2px solid ${({ theme }) => theme.colors.line};
  display: block;

  &:hover {
    border-color: ${({ theme }) => theme.colors.green[500]};
  }
`

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`

const AvatarOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  color: #fff;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  opacity: 0;
  transition: opacity 0.2s ease;

  ${AvatarWrapper}:hover & {
    opacity: 1;
  }
`

const HiddenInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`

const AvatarSticker = styled.img`
  width: 100%;
  max-width: 200px;
  margin-top: 2rem;
  opacity: 0.8;
`

const IdentityForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.xl};
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  -webkit-backdrop-filter: blur(${({ theme }) => theme.glass.blur});

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: ${({ theme }) => theme.spacing.lg};
  }
`

const FormSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`

const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`

const Chip = styled.button<{ $selected: boolean }>`
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid ${({ $selected, theme }) => ($selected ? theme.colors.green[580] : theme.colors.lineSoft)};
  background: ${({ $selected }) => ($selected ? 'rgba(65, 162, 56, 0.15)' : 'transparent')};
  color: ${({ $selected, theme }) => ($selected ? theme.colors.green[500] : theme.colors.text[380])};

  &:hover {
    border-color: ${({ theme }) => theme.colors.green[580]};
    color: ${({ theme }) => theme.colors.green[500]};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};
`

const SectionHeaderLeft = styled.div``

const InvitesContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`

const InviteRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.bg[940]};
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex-direction: column;
    align-items: flex-start;
    padding: ${({ theme }) => theme.spacing.md};
  }
`

const InviteIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.radii.lg};
  background: rgba(65, 162, 56, 0.12);
  color: ${({ theme }) => theme.colors.green[580]};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;
`

const InviteInfo = styled.div`
  flex: 1;
`

const InviteTitle = styled.p`
  color: ${({ theme }) => theme.colors.text[100]};
  font-weight: 500;
  font-size: ${({ theme }) => theme.typography.body};
`

const InviteActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-shrink: 0;
`

const HistoryLayout = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing['2xl']};
`

const HistorySectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex-direction: column;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing.md};
  }
`

const HistorySectionHeaderLeft = styled.div`
  h3 {
    margin-bottom: 0.25rem;
  }
`

const HeaderSticker = styled.img`
  width: 80px;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: 60px;
  }
`

const HistoryCategorySection = styled.div`
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  -webkit-backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  overflow: hidden;
`

const HistoryCategoryHeader = styled.div`
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineSoft};
  display: flex;
  align-items: center;
  justify-content: space-between;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  }
`

const HistoryCategoryTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
`

const CategoryIcon = styled.span`
  color: ${({ theme }) => theme.colors.green[580]};
  display: flex;
  align-items: center;
  font-size: 1rem;
`

const CategoryTitle = styled.h4`
  font-size: ${({ theme }) => theme.typography.body};
  color: ${({ theme }) => theme.colors.text[100]};
  font-weight: 600;
`

const CategoryCount = styled.span`
  font-size: ${({ theme }) => theme.typography.caption};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text[380]};
  background: ${({ theme }) => theme.colors.bg[940]};
  padding: 0.15rem 0.6rem;
  border-radius: ${({ theme }) => theme.radii.pill};
`

const HistoryCategoryContent = styled.div`
  padding: ${({ theme }) => theme.spacing.md};
`

const HistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const HistoryRow = styled(Link)<{ $active?: boolean; $past?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  background: ${({ $active }) => ($active ? 'rgba(65, 162, 56, 0.06)' : 'transparent')};
  border: 1px solid ${({ $active, theme }) => ($active ? theme.colors.line : 'transparent')};
  border-radius: ${({ theme }) => theme.radii.lg};
  text-decoration: none;
  transition: background 0.15s ease, border-color 0.15s ease;
  opacity: ${({ $past }) => ($past ? 0.65 : 1)};

  &:hover {
    background: ${({ theme }) => theme.colors.bg[940]};
    border-color: ${({ theme }) => theme.colors.lineSoft};
    opacity: 1;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex-wrap: wrap;
    padding: ${({ theme }) => theme.spacing.md};
  }
`

const HistoryThumb = styled.img`
  width: 64px;
  height: 48px;
  border-radius: ${({ theme }) => theme.radii.sm};
  object-fit: cover;
  flex-shrink: 0;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: 56px;
    height: 42px;
  }
`

const HistoryInfo = styled.div`
  flex: 1;
  min-width: 0;
`

const HistoryTitleRow = styled.h4`
  font-size: ${({ theme }) => theme.typography.body};
  color: ${({ theme }) => theme.colors.text[100]};
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.3rem;
`

const HistoryBadgeOffroad = styled.span`
  font-size: ${({ theme }) => theme.typography.caption};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.offroad.accent};
  background: ${({ theme }) => theme.colors.offroad.accentSoft};
  padding: 0.1rem 0.5rem;
  border-radius: ${({ theme }) => theme.radii.pill};
`

const HistoryBadgeActive = styled.span`
  font-size: ${({ theme }) => theme.typography.caption};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.green[500]};
  background: rgba(23, 247, 2, 0.12);
  padding: 0.1rem 0.5rem;
  border-radius: ${({ theme }) => theme.radii.pill};
`

const HistoryBadgeStatus = styled.span<{ $upcoming?: boolean; $past?: boolean }>`
  font-size: ${({ theme }) => theme.typography.caption};
  font-weight: 600;
  padding: 0.1rem 0.5rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  color: ${({ $upcoming, $past, theme }) =>
    $upcoming ? theme.colors.offroad.accent :
    $past ? theme.colors.text[500] :
    theme.colors.green[580]};
  background: ${({ $upcoming, $past, theme }) =>
    $upcoming ? theme.colors.offroad.accentSoft :
    $past ? 'rgba(122, 158, 116, 0.1)' :
    'rgba(65, 162, 56, 0.1)'};
`

const HistoryMetaRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.lg};
  flex-wrap: wrap;
`

const HistoryMetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[500]};
`

const HistorySkeletonGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const HistorySkeletonRow = styled.div`
  height: 64px;
  background: linear-gradient(
    90deg,
    rgba(65, 162, 56, 0.06) 25%,
    rgba(65, 162, 56, 0.12) 50%,
    rgba(65, 162, 56, 0.06) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: ${({ theme }) => theme.radii.md};

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`

const MatchesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
  }
`

const MatchCard = styled(Link)`
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.xl};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  -webkit-backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  overflow: hidden;
  text-decoration: none;
  transition: border-color 0.2s ease, transform 0.2s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.line};
    transform: translateY(-2px);
  }
`

const MatchBadge = styled.div`
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  padding: 0.25rem 0.7rem;
  font-size: ${({ theme }) => theme.typography.caption};
  font-weight: 700;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: #0a1e08;
  z-index: 1;
`

const MatchThumbWrap = styled.div`
  position: relative;
  height: 160px;
  overflow: hidden;
`

const MatchThumb = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`

const MatchContent = styled.div`
  padding: ${({ theme }) => theme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: ${({ theme }) => theme.spacing.md};
  }
`

const MatchEyebrow = styled.p`
  font-size: ${({ theme }) => theme.typography.eyebrow};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.green[580]};
`

const MatchTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.h3};
  color: ${({ theme }) => theme.colors.text[100]};
  line-height: 1.3;
`

const MatchDesc = styled.p`
  font-size: ${({ theme }) => theme.typography.bodySmall};
  color: ${({ theme }) => theme.colors.text[380]};
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`

const MatchReasons = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.5rem;
`

const MatchReason = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[380]};

  svg {
    color: ${({ theme }) => theme.colors.green[580]};
    flex-shrink: 0;
  }
`

const MatchMeta = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  padding-top: ${({ theme }) => theme.spacing.md};
  border-top: 1px solid ${({ theme }) => theme.colors.lineSoft};
`

const MatchPrice = styled.div`
  font-weight: 700;
  font-size: ${({ theme }) => theme.typography.body};
  color: ${({ theme }) => theme.colors.green[500]};
`

const MatchMembers = styled.div`
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[380]};
`

const MatchViewBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  font-family: inherit;
  border-radius: ${({ theme }) => theme.radii.pill};
  transition: all ${({ theme }) => theme.animation.duration.normal}s;
  min-height: 36px;
  min-width: 36px;
  white-space: nowrap;
  line-height: 1;
  padding: 0.4rem 0.9rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: #0a1e08;
  border: none;
  cursor: pointer;
  margin-top: 1rem;
  width: 100%;

  &:hover {
    background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[500]}, ${({ theme }) => theme.colors.green[300]});
  }
`

const NotificationsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`

const NotificationRow = styled.div<{ $unread: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  background: ${({ $unread, theme }) => ($unread ? 'rgba(65, 162, 56, 0.04)' : theme.colors.bg[940])};
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ $unread, theme }) => ($unread ? theme.colors.line : theme.colors.lineSoft)};
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: ${({ theme }) => theme.colors.bg[940]};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex-wrap: wrap;
    padding: ${({ theme }) => theme.spacing.md};
  }
`

const NotificationIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.radii.lg};
  background: rgba(65, 162, 56, 0.12);
  color: ${({ theme }) => theme.colors.green[580]};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;
`

const NotificationBody = styled.div`
  flex: 1;
`

const NotificationContent = styled.p`
  color: ${({ theme }) => theme.colors.text[100]};
  font-weight: 500;
  font-size: ${({ theme }) => theme.typography.body};
`

const NotificationTimestamp = styled.p`
  font-size: ${({ theme }) => theme.typography.caption};
  opacity: 0.5;
  margin-top: 0.2rem;
  color: ${({ theme }) => theme.colors.text[380]};
`

const NotificationDot = styled.span`
  position: absolute;
  top: 0.9rem;
  right: 0.9rem;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.green[500]};
  box-shadow: 0 0 6px rgba(23, 247, 2, 0.4);
`

export function ProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const shouldRedirectToLogin = !user
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ProfileTab>(() => {
    const requestedTab = searchParams.get('tab')
    return requestedTab && profileTabs.some((tab) => tab.key === requestedTab)
      ? (requestedTab as ProfileTab)
      : 'identity'
  })

  useEffect(() => {
    const requestedTab = searchParams.get('tab')
    const nextTab = requestedTab && profileTabs.some((tab) => tab.key === requestedTab)
      ? (requestedTab as ProfileTab)
      : 'identity'
    if (nextTab !== activeTab) {
      setActiveTab(nextTab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync tab from URL only
  }, [searchParams])

  const [avatarUrl, setAvatarUrl] = useState(getAvatarUrl(user?.username, user?.profileUrl))
  const [, setAvatarFileName] = useState('No image uploaded yet')
  const [description, setDescription] = useState(
    user?.description ?? DEFAULT_PROFILE_DESCRIPTION,
  )
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [tripTypes, setTripTypes] = useState<string[]>(() => [...(user?.tags ?? [])])
  const [maxGroupSize, setMaxGroupSize] = useState<number | ''>(
    user?.groupSize ?? '',
  )
  const [isSaving, setIsSaving] = useState(false)
  const { toasts, addToast, removeToast } = useToast()
  const [readNotificationIds, setReadNotificationIds] = useState<number[]>([])
  const [isMarkingNotificationId, setIsMarkingNotificationId] = useState<number | null>(null)
  const [isClearingNotifications, setIsClearingNotifications] = useState(false)
  const [isRespondingInviteId, setIsRespondingInviteId] = useState<string | null>(null)
  const [inviteResponseAction, setInviteResponseAction] = useState<'Accepted' | 'Declined' | null>(null)
  const [allTrips, setAllTrips] = useState<Trip[]>([])
  const [isFetchingAllTrips, setIsFetchingAllTrips] = useState(false)
  const [offroadTrips, setOffroadTrips] = useState<OffroadTrip[]>([])
  const [isFetchingOffroadTrips, setIsFetchingOffroadTrips] = useState(false)
  const objectUrlRef = useRef<string | null>(null)
  const tabListRef = useRef<HTMLElement | null>(null)

  const updateUserNotificationsAsRead = (notificationIds: number[]) => {
    if (!user || notificationIds.length === 0) {
      return
    }

    const notificationIdSet = new Set(notificationIds)
    const updatedNotifications = user.notifications.map((notification) => {
      if (!notificationIdSet.has(notification.id)) {
        return notification
      }

      return {
        ...notification,
        isRead: true,
        read: true,
        IsRead: true,
        Read: true,
      }
    })

    dispatch(
      setUser({
        user: {
          ...user,
          notifications: updatedNotifications,
        },
      }),
    )
  }

  useEffect(() => {
    if (!user) {
      return
    }

    setAvatarUrl(getAvatarUrl(user.username, user.profileUrl))
    setDescription(user.description || DEFAULT_PROFILE_DESCRIPTION)
    setTripTypes([...(user.tags ?? [])])
    setMaxGroupSize(user.groupSize ?? '')
  }, [user])

  useEffect(() => {
    const fetchUser = async () => {
      const res = await api.get('api/user/me')
      dispatch(setUser({ user: res.data }))
      console.log(res.data)
    }
    fetchUser()

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
    }
  }, [dispatch])

  useEffect(() => {
    if (!shouldRedirectToLogin) {
      return
    }

    addToast('You will be redirected in 2 seconds to login page', 'info')

    const timeoutId = window.setTimeout(() => {
      navigate('/login', { replace: true })
    }, 2000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [shouldRedirectToLogin, navigate])

  useEffect(() => {
    if (!user) return

    const fetchAll = async () => {
      setIsFetchingAllTrips(true)
      try {
        const res = await api.get('api/trip/get-all-trips')
        setAllTrips(res.data || [])
      } catch (err) {
        console.error('Failed to fetch discovery trips:', err)
      } finally {
        setIsFetchingAllTrips(false)
      }
    }

    const fetchOffroadTrips = async () => {
      setIsFetchingOffroadTrips(true)
      try {
        const res = await api.get('api/OffroadTrip/get-all-offroad-trips')
        setOffroadTrips(res.data || [])
      } catch (err) {
        console.error('Failed to fetch offroad trips:', err)
      } finally {
        setIsFetchingOffroadTrips(false)
      }
    }

    fetchAll()
    fetchOffroadTrips()
  }, [user])

  const memberOffroadTrips = useMemo(
    () => offroadTrips.filter((t) => t.isUserMember),
    [offroadTrips]
  )

  const allUserTrips = useMemo<TripWithType[]>(() => {
    const classicTrips = (user?.trips ?? []).map(t => ({ ...t, tripType: 'classic' as const }))
    const userOffroadTrips = memberOffroadTrips.map(t => ({ ...t, tripType: 'offroad' as const }))
    return [...classicTrips, ...userOffroadTrips]
  }, [user?.trips, memberOffroadTrips])

  const categorizedTrips = useMemo(() => {
    const active = allUserTrips.filter(isActiveTrip)
    const upcoming = allUserTrips.filter(isUpcomingTrip)
    const past = allUserTrips.filter(isPastTrip)

    const sortByDate = (a: TripWithType, b: TripWithType) =>
      new Date(a.startingDate).getTime() - new Date(b.startingDate).getTime()

    return {
      active: active.sort(sortByDate),
      upcoming: upcoming.sort(sortByDate),
      past: past.sort((a, b) => new Date(b.endingDate).getTime() - new Date(a.endingDate).getTime()),
    }
  }, [allUserTrips])

  const effectiveMaxGroupSize = typeof maxGroupSize === 'number' ? maxGroupSize : null

  const discoveryTrips = useMemo<PersonalizedTripCard[]>(() => {
    const userTripIds = new Set((user?.trips ?? []).map(t => String(t.id)))
    const userOffroadTripIds = new Set(memberOffroadTrips.map(t => String(t.id)))

    return allTrips
      .filter(trip => !userTripIds.has(String(trip.id)) && !userOffroadTripIds.has(String(trip.id)))
      .map((trip: Trip) => {
        const tagsSafe = trip.tags ?? []
        const matchingTags = tagsSafe.filter((tag: string) => tripTypes.includes(tag))

        let interestScore = 0
        if (tripTypes.length > 0) {
          interestScore = (matchingTags.length / tripTypes.length) * 100
        }

        const tripMax = trip.maxParticipants ?? Number.MAX_SAFE_INTEGER
        const groupAlignment =
          effectiveMaxGroupSize === null
            ? 0
            : tripMax <= effectiveMaxGroupSize
              ? 10
              : -7

        const matchScore = clamp(
          Math.round(interestScore * 0.8 + 20 + groupAlignment),
          0,
          100
        )

        const matchReasons = [
          matchingTags.length > 0
            ? `Shared trip styles: ${matchingTags.slice(0, 2).join(', ')}`
            : 'Explore a new travel vibe',
          effectiveMaxGroupSize === null
            ? 'Set a preferred group size for better results'
            : trip.maxParticipants <= effectiveMaxGroupSize
              ? 'Fits your preferred group size'
              : 'Larger group than your usual preference',
        ]

        return {
          id: String(trip.id),
          title: trip.title,
          coverImage: trip.imageUrl,
          description: trip.description,
          status: getTripStatusLabel(trip.status),
          timelineLength: (trip.timelines ?? []).length,
          startDate: formatDisplayDate(trip.startingDate),
          currentMembers: trip.currentMembers,
          maxMembers: trip.maxParticipants,
          price: trip.price,
          tags: tagsSafe,
          matchScore,
          matchReasons,
        }
      })
      .filter(card => card.matchScore >= 50)
      .sort((first, second) => second.matchScore - first.matchScore)
  }, [allTrips, user?.trips, memberOffroadTrips, tripTypes, effectiveMaxGroupSize])

  const visibleNotifications = useMemo(
    () =>
      (user?.notifications ?? []).filter(
        (notification) => !isNotificationRead(notification, readNotificationIds),
      ),
    [user?.notifications, readNotificationIds],
  )

  const visibleInvites = useMemo(() => {
    const invites: Array<{ tripId: string; invitedId: string; tripTitle: string }> = []

      ; (user?.trips ?? []).forEach((trip) => {
        const memberEntry = trip.members?.find((m) => {
          const usernameMatch = String((m as unknown as Record<string, unknown>).username) === String(user?.username)
          const memberObj = m as unknown as Record<string, unknown>
          const memberStatus = String(memberObj.status ?? memberObj.memberStatus ?? memberObj.member_status ?? '').toLowerCase()
          return usernameMatch && memberStatus === 'invited'
        })

        if (!memberEntry) return

        invites.push({
          tripId: String(trip.id),
          invitedId: String((memberEntry as unknown as Record<string, unknown>).id ?? ''),
          tripTitle: trip.title,
        })
      })

    return invites
  }, [user?.trips, user?.username])


  const handleAvatarUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) {
      return
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
    }

    const nextObjectUrl = URL.createObjectURL(selectedFile)
    objectUrlRef.current = nextObjectUrl

    setAvatarUrl(nextObjectUrl)
    setAvatarFileName(selectedFile.name)
    setAvatarFile(selectedFile)
  }

  const update = async (
    avatar: File | null,
    nextDescription: string,
    tags: string[],
    groupSize: number | '',
  ) => {
    const formData = new FormData()

    if (avatar) {
      formData.append('avatar', avatar)
    }

    formData.append('description', nextDescription)
    tags.forEach((tag) => formData.append('tags', tag))
    if (groupSize !== '') {
      formData.append('groupSize', groupSize.toString())
    }

    try {
      const response = await api.put('/api/user/update', formData)

      const updatedUser = (response.data) as User
      dispatch(
        setUser({
          user: updatedUser,
        }),
      )

      return updatedUser
    }
    catch (err: unknown) {
      if (isQueuedRequestError(err)) {
        addToast('Profile and preferences will be updated successfully.', 'success')
      }
      else {
        addToast('There was a problem updating your profile, please try again.', 'error')
        console.error(err)
      }
    }
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSaving) {
      return
    }

    setIsSaving(true)

    if (user) {
      const optimisticUser: User = {
        ...user,
        description: description.trim(),
        tags: tripTypes,
        groupSize: typeof maxGroupSize === 'number' ? maxGroupSize : user.groupSize
      }
      dispatch(setUser({ user: optimisticUser }))

      updateCachedResponse('api/user/me', optimisticUser)
    }

    try {
      const updatedUser = await update(
        avatarFile,
        description.trim(),
        tripTypes,
        maxGroupSize,
      )

      if (updatedUser) {
        if (updatedUser.profileUrl) {
          if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current)
            objectUrlRef.current = null
          }
          setAvatarUrl(updatedUser.profileUrl)
        }

        setAvatarFileName(avatarFile ? avatarFile.name : 'No image uploaded yet')
        setAvatarFile(null)
        addToast('Profile and preferences updated successfully.', 'success')
      }
    }
    catch (err: unknown) {
      if (isQueuedRequestError(err)) {
        addToast('Profile and preferences will be updated successfully.', 'success')
      }
      else {
        if (user) {
          dispatch(setUser({ user }))
          updateCachedResponse('api/user/me', user)
        }

        if (err instanceof AxiosError) {
          const message = err.response?.data?.message || err.response?.data || "There was a problem updating your profile, please try again later."
          addToast(String(message), 'error')
        }
        else {
          addToast('Could not update profile. Please try again.', 'error')
        }
      }
    }
    finally {
      await waitForBackendButtonUnlock()
      setIsSaving(false)
    }
  }

  const selectTab = (nextTab: ProfileTab) => {
    setActiveTab(nextTab)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', nextTab)
    setSearchParams(nextParams, { replace: true })
  }

  const focusTabAt = (index: number) => {
    const tabButtons = tabListRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]',
    )

    tabButtons?.[index]?.focus()
  }

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    let nextIndex: number | null = null

    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % profileTabs.length
    }

    if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + profileTabs.length) % profileTabs.length
    }

    if (event.key === 'Home') {
      nextIndex = 0
    }

    if (event.key === 'End') {
      nextIndex = profileTabs.length - 1
    }

    if (nextIndex === null) {
      return
    }

    event.preventDefault()
    const nextTab = profileTabs[nextIndex]
    selectTab(nextTab.key)
    focusTabAt(nextIndex)
  }

  const markNotificationAsRead = async (notificationId: number) => {
    if (isMarkingNotificationId === notificationId || isClearingNotifications) {
      return
    }

    setIsMarkingNotificationId(notificationId)
    try {
      const res = await api.post('/api/user/read-notification', { notificationId: notificationId })
      if (res.status == 200) {
        setReadNotificationIds((previous) =>
          previous.includes(notificationId)
            ? previous
            : [...previous, notificationId],
        )
        updateUserNotificationsAsRead([notificationId])
      }
    }
    catch (error) {
      console.error(error)
    } finally {
      setIsMarkingNotificationId(null)
    }
  }

  const markNotificationsAsRead = async () => {
    if (isClearingNotifications) {
      return
    }

    setIsClearingNotifications(true)
    try {
      const res = await api.post('/api/user/read-notifications')
      if (res.status == 200) {
        const allNotificationIds = (user?.notifications ?? []).map(
          (notification) => notification.id,
        )

        setReadNotificationIds((previous) =>
          Array.from(new Set([...previous, ...allNotificationIds])),
        )
        updateUserNotificationsAsRead(allNotificationIds)
      }
    }
    catch (error) {
      console.error(error)
    } finally {
      setIsClearingNotifications(false)
    }
  }

  const handleInviteResponse = async (tripId: string, action: 'Accepted' | 'Declined') => {
    if (isRespondingInviteId === tripId) {
      return
    }

    setIsRespondingInviteId(tripId)
    setInviteResponseAction(action)
    try {
      const response = await api.patch('api/trip/membership-response', {
        tripId: tripId,
        invitedId: user?.id,
        memberStatus: 'Invited',
        action: action === 'Accepted' ? 'accept' : 'decline',
      })
      if (response.status === 200) {
        addToast(`Trip invite ${action.toLowerCase()}ed.`, 'success')
        if (user) {
          const updatedTrips = user.trips.map(trip => {
            if (String(trip.id) === String(tripId)) {
              const updatedMembers = trip.members?.map(m => {
                if (String(m.id) === String(user.id)) {
                  return { ...m, status: action === 'Accepted' ? 'accepted' : 'declined' }
                }
                return m
              })
              return { ...trip, members: updatedMembers }
            }
            return trip
          })
          dispatch(setUser({ user: { ...user, trips: updatedTrips } }))
        }
      }

      const userRes = await api.get('api/user/me')
      dispatch(setUser({ user: userRes.data }))

    } catch (err: unknown) {
      if (isQueuedRequestError(err)) {
        if (user) {
          const updatedTrips = user.trips.map(trip => {
            if (String(trip.id) === String(tripId)) {
              const updatedMembers = trip.members?.map(m => {
                if (String(m.id) === String(user.id)) {
                  return { ...m, status: action === 'Accepted' ? 'accepted' : 'declined' }
                }
                return m
              })
              return { ...trip, members: updatedMembers }
            }
            return trip
          })
          dispatch(setUser({ user: { ...user, trips: updatedTrips } }))
        }
        addToast(`Invite response will be sent when online.`, 'success')
      } else {
        const fallbackMessage = `Failed to ${action.toLowerCase()} invite.`
        addToast(getErrorMessage(err, fallbackMessage), 'error')
      }
    } finally {
      setIsRespondingInviteId(null)
      setInviteResponseAction(null)
    }
  }

  if (!user) {
    return (
      <Page>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <UnauthedWrapper>
          <UnauthedSticker src="/newstickers/sticker5.png" alt="" />
          <UnauthedTitle>You are not logged in</UnauthedTitle>
          <UnauthedDesc>Log in to edit your profile and unlock personalized trip discovery.</UnauthedDesc>
          <UnauthedLink to="/login">
            Go to login
          </UnauthedLink>
        </UnauthedWrapper>
      </Page>
    )
  }

  return (
    <Page>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <Header>
        <HeaderText>
          <Eyebrow>Explorer Workspace</Eyebrow>
          <HeaderTitle>Welcome, {user.username}</HeaderTitle>
        </HeaderText>
        <TabList
          ref={tabListRef}
          aria-label="Profile sections"
          role="tablist"
        >
          {profileTabs.map((tab, index) => (
            <Tab
              key={tab.key}
              type="button"
              id={`profile-tab-${tab.key}`}
              $active={activeTab === tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`profile-panel-${tab.key}`}
              tabIndex={activeTab === tab.key ? 0 : -1}
              onClick={() => selectTab(tab.key)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              title={tab.label}
            >
              <TabLabelDesktop>{tab.label}</TabLabelDesktop>
              <TabIconMobile aria-hidden="true">
                <tab.icon />
              </TabIconMobile>
              {activeTab === tab.key && (
                <TabActiveBar
                  layoutId="profile-tab-indicator"
                  initial={false}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
            </Tab>
          ))}
        </TabList>
      </Header>

      <AnimatePresence mode="popLayout" initial={false}>
        {activeTab === 'identity' ? (
          <Panel
            key="identity"
            id="profile-panel-identity"
            role="tabpanel"
            aria-labelledby="profile-tab-identity"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={revealTransition}
          >
            <IdentityLayout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <AvatarSection>
                <AvatarWrapper htmlFor="profile-avatar-file">
                  <AvatarImg src={avatarUrl} alt="Profile" />
                  <AvatarOverlay>
                    <FiUploadCloud size={24} />
                    <span>Update photo</span>
                  </AvatarOverlay>
                </AvatarWrapper>
                <HiddenInput
                  id="profile-avatar-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={isSaving}
                  onChange={handleAvatarUpload}
                />
                <AvatarSticker src="/newstickers/sticker2.png" alt="" />
              </AvatarSection>

              <IdentityForm onSubmit={handleSave}>
                <FormSection>
                  <SectionTitle>Identity Details</SectionTitle>
                  <FieldLabel htmlFor="profile-description">
                    About me / Bio
                  </FieldLabel>
                  <TextArea
                    id="profile-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    disabled={isSaving}
                    rows={4}
                    placeholder="Tell us about your travel style..."
                  />
                </FormSection>

                <FormSection>
                  <SectionTitle>Travel DNA</SectionTitle>
                  <ChipRow>
                    {tripTypeOptions.map((tripType) => {
                      const selected = tripTypes.includes(tripType)
                      return (
                        <Chip
                          key={tripType}
                          type="button"
                          $selected={selected}
                          disabled={isSaving}
                          onClick={() => setTripTypes((previous) => toggleTripType(previous, tripType))}
                        >
                          {tripType}
                        </Chip>
                      )
                    })}
                  </ChipRow>

                  <div style={{ marginTop: '1rem' }}>
                    <FieldLabel htmlFor="profile-max-group">
                      Ideal Group Size
                    </FieldLabel>
                    <Input
                      id="profile-max-group"
                      type="number"
                      min={2}
                      max={30}
                      value={maxGroupSize}
                      disabled={isSaving}
                      placeholder="Leave empty if not set"
                      onChange={(event) => {
                        const nextValue = event.target.value
                        setMaxGroupSize(nextValue === '' ? '' : Number(nextValue))
                      }}
                    />
                  </div>
                </FormSection>

                <PrimaryBtn type="submit" disabled={isSaving}>
                  {isSaving ? 'Syncing...' : 'Save Profile Workspace'}
                </PrimaryBtn>
              </IdentityForm>
            </IdentityLayout>
          </Panel>
        ) : null}

        {activeTab === 'invites' ? (
          <Panel
            key="invites"
            id="profile-panel-invites"
            role="tabpanel"
            aria-labelledby="profile-tab-invites"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={revealTransition}
          >
            <Section>
              <SectionHeader>
                <SectionHeaderLeft>
                  <SectionTitle>Trip Invitations</SectionTitle>
                  <SectionDesc>Manage your pending trip invitations.</SectionDesc>
                </SectionHeaderLeft>
              </SectionHeader>

              <InvitesContainer>
                {visibleInvites.length === 0 && (
                  <EmptyState
                    image="/newstickers/sticker4.png"
                    title="No pending invitations."
                  />
                )}
                {visibleInvites.map((invite) => (
                  <InviteRow key={invite.tripId}>
                    <InviteIcon>
                      <FiMail />
                    </InviteIcon>
                    <InviteInfo>
                      <InviteTitle>Invitation to {invite.tripTitle}</InviteTitle>
                    </InviteInfo>
                    <InviteActions>
                      <SmallPrimaryBtn
                        disabled={isRespondingInviteId === invite.tripId}
                        onClick={() => handleInviteResponse(invite.tripId, 'Accepted')}
                      >
                        {isRespondingInviteId === invite.tripId && inviteResponseAction === 'Accepted'
                          ? 'Accepting...'
                          : 'Accept'}
                      </SmallPrimaryBtn>
                      <GhostBtn
                        disabled={isRespondingInviteId === invite.tripId}
                        onClick={() => handleInviteResponse(invite.tripId, 'Declined')}
                      >
                        {isRespondingInviteId === invite.tripId && inviteResponseAction === 'Declined'
                          ? 'Declining...'
                          : 'Decline'}
                      </GhostBtn>
                    </InviteActions>
                  </InviteRow>
                ))}
              </InvitesContainer>
            </Section>
          </Panel>
        ) : null}

        {activeTab === 'history' ? (
          <Panel
            key="history"
            id="profile-panel-history"
            role="tabpanel"
            aria-labelledby="profile-tab-history"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={revealTransition}
          >
            <Section>
              <HistorySectionHeader>
                <HistorySectionHeaderLeft>
                  <SectionTitle>My Travels</SectionTitle>
                  <SectionDesc>Your journey through various territories.</SectionDesc>
                </HistorySectionHeaderLeft>
                <HeaderSticker src="/newstickers/sticker3.png" alt="" />
              </HistorySectionHeader>

              <HistoryLayout>
                <HistoryCategorySection>
                  <HistoryCategoryHeader>
                    <HistoryCategoryTitle>
                      <CategoryIcon><FiClock /></CategoryIcon>
                      <CategoryTitle>Active Trips</CategoryTitle>
                      <CategoryCount>{categorizedTrips.active.length}</CategoryCount>
                    </HistoryCategoryTitle>
                  </HistoryCategoryHeader>
                  <HistoryCategoryContent>
                    {isFetchingOffroadTrips && categorizedTrips.active.length === 0 ? (
                      <HistorySkeletonGroup>
                        <HistorySkeletonRow />
                        <HistorySkeletonRow />
                      </HistorySkeletonGroup>
                    ) : categorizedTrips.active.length === 0 ? (
                      <EmptyState image="/newstickers/sticker3.png" title="No active trips at the moment." />
                    ) : (
                      <HistoryList>
                        {categorizedTrips.active.map((trip) => (
                          <HistoryRow
                            key={`${trip.tripType}-${trip.id}`}
                            $active
                            to={trip.tripType === 'offroad' ? `/app/offroad/${trip.id}` : `/app/trip/${trip.id}`}
                          >
                            <HistoryThumb src={trip.imageUrl} alt="" />
                            <HistoryInfo>
                              <HistoryTitleRow>
                                {trip.title}
                                {trip.tripType === 'offroad' && (
                                  <HistoryBadgeOffroad>Offroad</HistoryBadgeOffroad>
                                )}
                                <HistoryBadgeActive>Active</HistoryBadgeActive>
                              </HistoryTitleRow>
                              <HistoryMetaRow>
                                <HistoryMetaItem>
                                  <FiCalendar size={12} />
                                  {formatDisplayDateRange(trip.startingDate, trip.endingDate)}
                                </HistoryMetaItem>
                                <HistoryMetaItem>
                                  <FiUsers size={12} />
                                  {trip.currentMembers}/{trip.maxParticipants} members
                                </HistoryMetaItem>
                              </HistoryMetaRow>
                            </HistoryInfo>
                            <FiChevronDown style={{ transform: 'rotate(-90deg)', opacity: 0.4 }} />
                          </HistoryRow>
                        ))}
                      </HistoryList>
                    )}
                  </HistoryCategoryContent>
                </HistoryCategorySection>

                <HistoryCategorySection>
                  <HistoryCategoryHeader>
                    <HistoryCategoryTitle>
                      <CategoryIcon><FiCalendar /></CategoryIcon>
                      <CategoryTitle>Upcoming Trips</CategoryTitle>
                      <CategoryCount>{categorizedTrips.upcoming.length}</CategoryCount>
                    </HistoryCategoryTitle>
                  </HistoryCategoryHeader>
                  <HistoryCategoryContent>
                    {isFetchingOffroadTrips && categorizedTrips.upcoming.length === 0 ? (
                      <HistorySkeletonGroup>
                        <HistorySkeletonRow />
                        <HistorySkeletonRow />
                      </HistorySkeletonGroup>
                    ) : categorizedTrips.upcoming.length === 0 ? (
                      <div>
                        <EmptyState
                          image="/newstickers/sticker1.png"
                          title="No upcoming trips planned. Start exploring!"
                          action={
                            <DiscoverLink to="/app/discover">
                              <FiCompass /> Discover Trips
                            </DiscoverLink>
                          }
                        />
                      </div>
                    ) : (
                      <HistoryList>
                        {categorizedTrips.upcoming.map((trip) => (
                          <HistoryRow
                            key={`${trip.tripType}-${trip.id}`}
                            to={trip.tripType === 'offroad' ? `/app/offroad/${trip.id}` : `/app/trip/${trip.id}`}
                          >
                            <HistoryThumb src={trip.imageUrl} alt="" />
                            <HistoryInfo>
                              <HistoryTitleRow>
                                {trip.title}
                                {trip.tripType === 'offroad' && (
                                  <HistoryBadgeOffroad>Offroad</HistoryBadgeOffroad>
                                )}
                                <HistoryBadgeStatus $upcoming={isUpcomingTripStatus(trip.status)}>
                                  {getTripStatusLabel(trip.status)}
                                </HistoryBadgeStatus>
                              </HistoryTitleRow>
                              <HistoryMetaRow>
                                <HistoryMetaItem>
                                  <FiCalendar size={12} />
                                  {formatDisplayDateRange(trip.startingDate, trip.endingDate)}
                                </HistoryMetaItem>
                                <HistoryMetaItem>
                                  <FiUsers size={12} />
                                  {trip.currentMembers}/{trip.maxParticipants} members
                                </HistoryMetaItem>
                              </HistoryMetaRow>
                            </HistoryInfo>
                            <FiChevronDown style={{ transform: 'rotate(-90deg)', opacity: 0.4 }} />
                          </HistoryRow>
                        ))}
                      </HistoryList>
                    )}
                  </HistoryCategoryContent>
                </HistoryCategorySection>

                <HistoryCategorySection>
                  <HistoryCategoryHeader>
                    <HistoryCategoryTitle>
                      <CategoryIcon><FiZap /></CategoryIcon>
                      <CategoryTitle>Past Trips</CategoryTitle>
                      <CategoryCount>{categorizedTrips.past.length}</CategoryCount>
                    </HistoryCategoryTitle>
                  </HistoryCategoryHeader>
                  <HistoryCategoryContent>
                    {isFetchingOffroadTrips && categorizedTrips.past.length === 0 ? (
                      <HistorySkeletonGroup>
                        <HistorySkeletonRow />
                        <HistorySkeletonRow />
                      </HistorySkeletonGroup>
                    ) : categorizedTrips.past.length === 0 ? (
                      <EmptyState image="/newstickers/sticker4.png" title="Your history is currently a blank map." />
                    ) : (
                      <HistoryList>
                        {categorizedTrips.past.map((trip) => (
                          <HistoryRow
                            key={`${trip.tripType}-${trip.id}`}
                            $past
                            to={trip.tripType === 'offroad' ? `/app/offroad/${trip.id}` : `/app/trip/${trip.id}`}
                          >
                            <HistoryThumb src={trip.imageUrl} alt="" />
                            <HistoryInfo>
                              <HistoryTitleRow>
                                {trip.title}
                                {trip.tripType === 'offroad' && (
                                  <HistoryBadgeOffroad>Offroad</HistoryBadgeOffroad>
                                )}
                                <HistoryBadgeStatus $past={isFinishedTripStatus(trip.status)}>
                                  {getTripStatusLabel(trip.status)}
                                </HistoryBadgeStatus>
                              </HistoryTitleRow>
                              <HistoryMetaRow>
                                <HistoryMetaItem>
                                  <FiCalendar size={12} />
                                  {formatDisplayDateRange(trip.startingDate, trip.endingDate)}
                                </HistoryMetaItem>
                                <HistoryMetaItem>
                                  <FiUsers size={12} />
                                  {trip.currentMembers}/{trip.maxParticipants} members
                                </HistoryMetaItem>
                              </HistoryMetaRow>
                            </HistoryInfo>
                            <FiChevronDown style={{ transform: 'rotate(-90deg)', opacity: 0.4 }} />
                          </HistoryRow>
                        ))}
                      </HistoryList>
                    )}
                  </HistoryCategoryContent>
                </HistoryCategorySection>
              </HistoryLayout>
            </Section>
          </Panel>
        ) : null}

        {activeTab === 'matches' ? (
          <Panel
            key="matches"
            id="profile-panel-matches"
            role="tabpanel"
            aria-labelledby="profile-tab-matches"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={revealTransition}
          >
            <Section>
              <SectionHeader>
                <SectionHeaderLeft>
                  <SectionTitle>Match Intelligence</SectionTitle>
                  <SectionDesc>Trips that resonate with your travel DNA.</SectionDesc>
                </SectionHeaderLeft>
                <GhostLink to="/app/discover">
                  <FiCompass /> Full Discovery
                </GhostLink>
              </SectionHeader>

              <MatchesGrid>
                {isFetchingAllTrips ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <SkeletonCard key={idx} />
                  ))
                ) : discoveryTrips.length === 0 ? (
                  <EmptyState
                    image="/newstickers/sticker5.png"
                    title="No matches found."
                    description="Try adjusting your preferences in Identity."
                  />
                ) : (
                  discoveryTrips.slice(0, 6).map((trip) => (
                    <MatchCard key={trip.id} to={`/app/trip/${trip.id}`}>
                      <MatchThumbWrap>
                        <MatchBadge>{trip.matchScore}% Match</MatchBadge>
                        <MatchThumb src={trip.coverImage || '/newstickers/sticker1.png'} alt="" />
                      </MatchThumbWrap>

                      <MatchContent>
                        <MatchEyebrow>{trip.status}</MatchEyebrow>
                        <MatchTitle>{trip.title}</MatchTitle>
                        <MatchDesc>{trip.description}</MatchDesc>

                        <MatchReasons>
                          {trip.matchReasons.map((reason, idx) => (
                            <MatchReason key={idx}>
                              <FiZap size={12} />
                              <span>{reason}</span>
                            </MatchReason>
                          ))}
                        </MatchReasons>

                        <MatchMeta>
                          <MatchPrice>{trip.price} EUR</MatchPrice>
                          <MatchMembers>{trip.currentMembers}/{trip.maxMembers} Explorers</MatchMembers>
                        </MatchMeta>

                        <MatchViewBtn>View Workspace</MatchViewBtn>
                      </MatchContent>
                    </MatchCard>
                  ))
                )}
              </MatchesGrid>
            </Section>
          </Panel>
        ) : null}

        {activeTab === 'notifications' ? (
          <Panel
            key="notifications"
            id="profile-panel-notifications"
            role="tabpanel"
            aria-labelledby="profile-tab-notifications"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={revealTransition}
          >
            <Section>
              <SectionHeader>
                <SectionHeaderLeft>
                  <SectionTitle>Intelligence Feed</SectionTitle>
                  <SectionDesc>Stay updated on trip changes.</SectionDesc>
                </SectionHeaderLeft>
                <GhostBtn
                  disabled={isClearingNotifications || visibleNotifications.length === 0}
                  onClick={markNotificationsAsRead}
                >
                  {isClearingNotifications ? 'Clearing...' : 'Clear all'}
                </GhostBtn>
              </SectionHeader>

              <NotificationsContainer>
                {visibleNotifications.length === 0 && (
                  <EmptyState
                    image="/newstickers/sticker6.png"
                    title="All quiet on the trip front."
                  />
                )}
                {visibleNotifications.map((notification) => {
                  const read = isNotificationRead(notification, readNotificationIds)
                  return (
                    <NotificationRow
                      key={notification.id}
                      $unread={!read}
                      onClick={() => {
                        if (!read && isMarkingNotificationId !== notification.id && !isClearingNotifications) {
                          markNotificationAsRead(notification.id)
                        }
                      }}
                    >
                      <NotificationIcon>
                        <FiBell />
                      </NotificationIcon>
                      <NotificationBody>
                        <NotificationContent>{notification.content}</NotificationContent>
                        <NotificationTimestamp>
                          {formatNotificationTimestamp(notification)}
                        </NotificationTimestamp>
                      </NotificationBody>
                      <GhostBtn
                        type="button"
                        disabled={read || isMarkingNotificationId === notification.id || isClearingNotifications}
                        onClick={(event) => {
                          event.stopPropagation()
                          if (!read) {
                            markNotificationAsRead(notification.id)
                          }
                        }}
                        style={{ fontSize: '0.75rem', minHeight: '30px', padding: '0.25rem 0.7rem' }}
                      >
                        {read
                          ? 'Read'
                          : isMarkingNotificationId === notification.id
                            ? 'Marking...'
                            : 'Mark as read'}
                      </GhostBtn>
                      {!read && <NotificationDot />}
                    </NotificationRow>
                  )
                })}
              </NotificationsContainer>
            </Section>
          </Panel>
        ) : null}
      </AnimatePresence>
    </Page>
  )
}
