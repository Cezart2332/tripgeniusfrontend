import { AnimatePresence, motion } from 'framer-motion'
import * as signalR from '@microsoft/signalr'
import { useEffect, useRef, useState } from 'react'
import { FiCheck, FiDownload, FiEdit2, FiMap, FiMessageSquare, FiPlus, FiTrash2, FiUserPlus, FiX, FiUsers } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import api from '../data/api'
import type { ChatMessage, MemberRole, OffroadTrip, User } from '../types/models'
import { OffroadRouteMap } from './OffroadRouteMap'
import { formatDisplayDate } from '../utils/dateDisplay'
import { getTripStatusLabel } from '../utils/tripStatus'
import { getErrorMessage } from '../utils/errorMessage'
import { downloadBlob } from '../utils/gpx'
import { getAvatarUrl } from '../utils/userUtils'
import { registerChatModerationEvents } from '../hooks/useChatModerationEvents'
import styled from 'styled-components'

interface OffroadTripModalProps {
  trip: OffroadTrip | null
  isOpen: boolean
  onClose: () => void
  onTripUpdate: (trip: OffroadTrip) => void
}

interface AuthStoreState {
  auth: { user: User | null; token: string | null }
}

type ModalTab = 'details' | 'members' | 'chat'

const roleOrder: Record<MemberRole, number> = { owner: 0, admin: 1, member: 2 }

const Scrim = styled(motion.div)`
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`

const ModalCard = styled(motion.div)`
  background: ${({ theme }) => theme.glass.bgStrong};
  border: 1px solid ${({ theme }) => theme.glass.border};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: ${({ theme }) => theme.radii.xl};
  width: 100%;
  max-width: 640px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: ${({ theme }) => theme.shadows.xl};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    max-height: 92vh;
    border-radius: ${({ theme }) => theme.radii.lg};
  }
`

const ModalHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.lg};
  gap: ${({ theme }) => theme.spacing.md};
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineSoft};
`

const HeaderContent = styled.div`
  flex: 1;
  min-width: 0;
`

const OffroadBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.65rem;
  font-size: ${({ theme }) => theme.typography.eyebrow};
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme }) => theme.colors.offroad.accentSoft};
  color: ${({ theme }) => theme.colors.offroad.accent};
  border: 1px solid rgba(201, 162, 39, 0.3);
  margin-bottom: 0.5rem;
`

const ModalTitle = styled.h2`
  font-size: ${({ theme }) => theme.typography.h2};
  color: ${({ theme }) => theme.colors.text[100]};
  margin-bottom: 0.25rem;
`

const ModalDescription = styled.p`
  color: ${({ theme }) => theme.colors.text[380]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  margin-bottom: 0.5rem;
`

const ModalMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[500]};
`

const CloseButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: ${({ theme }) => theme.radii.full};
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(243, 255, 241, 0.06);
  color: ${({ theme }) => theme.colors.text[380]};
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(243, 255, 241, 0.12);
    color: ${({ theme }) => theme.colors.text[100]};
  }
`

const JoinBanner = styled.div`
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  background: rgba(201, 162, 39, 0.06);
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineSoft};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;

  p {
    font-size: ${({ theme }) => theme.typography.bodySmall};
    color: ${({ theme }) => theme.colors.text[220]};
    margin: 0;
    flex: 1;
  }
`

const PrimaryBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  border: none;
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.green[580]};
  color: ${({ theme }) => theme.colors.text[100]};
  cursor: pointer;
  transition: background 0.2s ease;
  white-space: nowrap;

  &:hover { background: ${({ theme }) => theme.colors.green[700]}; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`

const ErrorText = styled.p`
  color: ${({ theme }) => theme.colors.danger[400]};
  font-size: ${({ theme }) => theme.typography.caption};
  margin-top: 0.35rem;
`

const SuccessText = styled.p`
  color: ${({ theme }) => theme.colors.green[500]};
  font-size: ${({ theme }) => theme.typography.caption};
  margin-top: 0.35rem;
`

const TabsRow = styled.div`
  display: flex;
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineSoft};
  padding: 0 ${({ theme }) => theme.spacing.sm};
`

const Tab = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.7rem 1rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: ${({ $active }) => $active ? 700 : 500};
  color: ${({ $active, theme }) => $active ? theme.colors.text[100] : theme.colors.text[380]};
  background: transparent;
  border: none;
  border-bottom: 2px solid ${({ $active, theme }) => $active ? theme.colors.green[580] : 'transparent'};
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease;
  white-space: nowrap;

  &:hover {
    color: ${({ theme }) => theme.colors.text[220]};
  }
`

const ModalContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
`

const MapWrap = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radii.md};
  overflow: hidden;
`

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing.md};
  gap: ${({ theme }) => theme.spacing.sm};

  h3 {
    font-size: ${({ theme }) => theme.typography.h3};
    color: ${({ theme }) => theme.colors.text[100]};
  }

  h4 {
    font-size: ${({ theme }) => theme.typography.body};
    color: ${({ theme }) => theme.colors.text[100]};
  }
`

const EmptyState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.xl} 0;

  p {
    color: ${({ theme }) => theme.colors.text[380]};
    font-size: ${({ theme }) => theme.typography.bodySmall};
    margin-bottom: ${({ theme }) => theme.spacing.md};
  }
`

const RouteList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`

const RouteCard = styled.div<{ $selected: boolean }>`
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ $selected, theme }) => $selected ? theme.colors.offroad.accent : theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => theme.spacing.md};
  transition: border-color 0.2s ease;
`

const RouteCardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.4rem;

  h4 {
    font-size: ${({ theme }) => theme.typography.body};
    color: ${({ theme }) => theme.colors.text[100]};
    flex: 1 1 auto;
    min-width: 0;
    overflow-wrap: anywhere;
  }
`

const RouteSource = styled.span<{ $drawn: boolean }>`
  font-size: ${({ theme }) => theme.typography.eyebrow};
  font-weight: 600;
  text-transform: uppercase;
  padding: 0.15rem 0.5rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: rgba(169, 200, 163, 0.1);
  color: ${({ theme }) => theme.colors.text[380]};

  ${({ $drawn, theme }) => $drawn && `
    background: ${theme.colors.offroad.accentSoft};
    color: ${theme.colors.offroad.accent};
  `}
`

const RouteMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[380]};

  strong {
    color: ${({ theme }) => theme.colors.text[100]};
  }
`

const MutedText = styled.p`
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[500]};
  margin-top: 0.35rem;
`

const RouteActions = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 0.65rem;
  flex-wrap: wrap;
`

const GhostBtn = styled.button<{ $danger?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0.4rem 0.7rem;
  font-size: ${({ theme }) => theme.typography.caption};
  font-weight: 500;
  border: none;
  border-radius: ${({ theme }) => theme.radii.sm};
  background: rgba(243, 255, 241, 0.06);
  color: ${({ $danger, theme }) => $danger ? theme.colors.danger[500] : theme.colors.text[380]};
  cursor: pointer;
  transition: all 0.15s ease;
  text-decoration: none;
  white-space: nowrap;
  box-sizing: border-box;
  flex-shrink: 0;
  max-width: 100%;

  &:hover {
    background: rgba(243, 255, 241, 0.12);
    color: ${({ $danger, theme }) => $danger ? theme.colors.danger[400] : theme.colors.text[100]};
  }

  .label-short {
    display: none;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    .label-full {
      display: none;
    }

    .label-short {
      display: inline;
    }
  }
`

const GhostLink = styled(Link)<{ $danger?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.7rem;
  font-size: ${({ theme }) => theme.typography.caption};
  font-weight: 500;
  border: none;
  border-radius: ${({ theme }) => theme.radii.sm};
  background: rgba(243, 255, 241, 0.06);
  color: ${({ $danger, theme }) => $danger ? theme.colors.danger[500] : theme.colors.text[380]};
  cursor: pointer;
  transition: all 0.15s ease;
  text-decoration: none;
  white-space: nowrap;

  &:hover {
    background: rgba(243, 255, 241, 0.12);
    color: ${({ $danger, theme }) => $danger ? theme.colors.danger[400] : theme.colors.text[100]};
  }
`

const PrimaryLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  border: none;
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.green[580]};
  color: ${({ theme }) => theme.colors.text[100]};
  cursor: pointer;
  transition: background 0.2s ease;
  text-decoration: none;
  white-space: nowrap;
  margin-top: 1rem;

  &:hover { background: ${({ theme }) => theme.colors.green[700]}; }
`

const InviteForm = styled.form`
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.md};

  h4 {
    font-size: ${({ theme }) => theme.typography.body};
    color: ${({ theme }) => theme.colors.text[100]};
    margin-bottom: ${({ theme }) => theme.spacing.sm};
  }
`

const InviteInputGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`

const StyledInput = styled.input`
  flex: 1;
  padding: 0.55rem 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  border-radius: ${({ theme }) => theme.radii.md};
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s ease;

  &:focus {
    border-color: ${({ theme }) => theme.colors.green[580]};
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.text[500]};
  }

  &:disabled {
    opacity: 0.5;
  }
`

const StyledSelect = styled.select`
  padding: 0.3rem 0.5rem;
  font-size: ${({ theme }) => theme.typography.caption};
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  border-radius: ${({ theme }) => theme.radii.sm};
  color: ${({ theme }) => theme.colors.text[100]};
  font-family: inherit;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.green[580]};
  }
`

const PendingSection = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`

const MembersSection = styled.div`
  h4 {
    font-size: ${({ theme }) => theme.typography.body};
    color: ${({ theme }) => theme.colors.text[100]};
    margin-bottom: ${({ theme }) => theme.spacing.sm};
  }
`

const MemberCard = styled.div<{ $pending?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.8rem;
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  border-radius: ${({ theme }) => theme.radii.md};
  margin-bottom: 0.5rem;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;

  ${({ $pending, theme }) => $pending && `
    border-color: ${theme.colors.offroad.accentSoft};
  `}
`

const MemberInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex: 1;
  min-width: 0;
`

const MemberAvatar = styled.img`
  width: 36px;
  height: 36px;
  border-radius: ${({ theme }) => theme.radii.full};
  object-fit: cover;
  flex-shrink: 0;
`

const MemberNameGroup = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;

  strong {
    font-size: ${({ theme }) => theme.typography.bodySmall};
    color: ${({ theme }) => theme.colors.text[100]};
  }
`

const MemberRole = styled.span<{ $role?: string }>`
  font-size: ${({ theme }) => theme.typography.eyebrow};
  text-transform: capitalize;
  color: ${({ theme }) => theme.colors.text[500]};

  ${({ $role, theme }) => $role === 'owner' && `color: ${theme.colors.offroad.accent};`}
  ${({ $role, theme }) => $role === 'admin' && `color: ${theme.colors.green[500]};`}
`

const MemberActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`

const ChatLocked = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.xl} 0;
  text-align: center;
  gap: ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.colors.text[500]};

  p {
    color: ${({ theme }) => theme.colors.text[380]};
    font-size: ${({ theme }) => theme.typography.bodySmall};
  }
`

const ChatMessages = styled.div`
  flex: 1;
  overflow-y: auto;
  max-height: 320px;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
  padding-right: ${({ theme }) => theme.spacing.xs};
`

const ChatEmpty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.colors.text[380]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  text-align: center;
`

const ChatBubble = styled.div<{ $self: boolean }>`
  padding: 0.6rem 0.8rem;
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ $self, theme }) => $self ? 'rgba(23, 247, 2, 0.08)' : theme.glass.bg};
  border: 1px solid ${({ $self, theme }) => $self ? 'rgba(23, 247, 2, 0.15)' : theme.glass.border};
  margin-left: ${({ $self }) => $self ? 'auto' : '0'};
  margin-right: ${({ $self }) => $self ? '0' : 'auto'};
  max-width: 85%;

  p {
    color: ${({ theme }) => theme.colors.text[100]};
    font-size: ${({ theme }) => theme.typography.bodySmall};
    margin: 0;
    word-break: break-word;
  }
`

const ChatBubbleHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.2rem;

  strong {
    font-size: ${({ theme }) => theme.typography.caption};
    color: ${({ theme }) => theme.colors.text[220]};
  }
`

const ChatAvatar = styled.img`
  width: 20px;
  height: 20px;
  border-radius: ${({ theme }) => theme.radii.full};
  object-fit: cover;
  flex-shrink: 0;
`

const ChatTime = styled.span`
  font-size: ${({ theme }) => theme.typography.eyebrow};
  color: ${({ theme }) => theme.colors.text[500]};
  margin-left: auto;
`

const ChatCompose = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;

  ${StyledInput} {
    flex: 1;
  }
`

export function OffroadTripModal({ trip, isOpen, onClose, onTripUpdate }: OffroadTripModalProps) {
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const token = useSelector((state: AuthStoreState) => state.auth.token)
  const baseURL = import.meta.env.VITE_BASE_URL
  const [activeTab, setActiveTab] = useState<ModalTab>('details')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [inviteUsername, setInviteUsername] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const connectionRef = useRef<signalR.HubConnection | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isOwner = trip?.members.some((m) => m.id === String(user?.id) && m.role === 'owner') ?? false
  const isAdmin = trip?.members.some((m) => m.id === String(user?.id) && (m.role === 'owner' || m.role === 'admin')) ?? false
  const isMember = trip?.members.some((m) => m.id === String(user?.id)) ?? false
  const pendingRequests = trip?.members.filter((m) => m.status === 'pending') ?? []

  useEffect(() => {
    if (isOpen) {
      setActiveTab('details')
      setJoinError(null)
      setInviteError(null)
      setInviteSuccess(null)
      setInviteUsername('')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !trip || !token) {
      setChatMessages([])
      return
    }

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${baseURL}/hubs/offroad-trip-chat?access_token=${token}`)
      .withAutomaticReconnect()
      .build()

    connection.on('ReceiveMessage', (msg: ChatMessage) => {
      setChatMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
    })

    registerChatModerationEvents(connection, setChatMessages, (payload) => {
      console.warn(payload.message ?? 'Message removed by moderation.')
    })

    connectionRef.current = connection
    let stopped = false

    const start = async () => {
      try {
        await connection.start()
        if (!stopped) await connection.invoke('JoinOffroadTrip', Number(trip.id))
      } catch (err) {
        console.error('Offroad chat connection failed', err)
      }
    }
    start()

    api
      .get(`api/OffroadTrip/get-messages/${trip.id}`)
      .then((res) => {
        if (Array.isArray(res.data)) setChatMessages(res.data)
      })
      .catch(() => {})

    return () => {
      stopped = true
      void (async () => {
        try {
          if (connection.state === signalR.HubConnectionState.Connected) {
            await connection.invoke('LeaveOffroadTrip', Number(trip.id))
          }
        } catch {
          /* ignore */
        }
        await connection.stop()
      })()
    }
  }, [isOpen, trip, token, baseURL])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, activeTab])

  const sendMessage = async () => {
    if (!newMessage.trim() || !connectionRef.current || !trip) return
    try {
      await connectionRef.current.invoke('SendMessage', Number(trip.id), newMessage.trim())
      setNewMessage('')
    } catch (err) {
      console.error(getErrorMessage(err))
    }
  }

  const exportRouteGpx = async (routeId: number) => {
    if (!trip) return
    const res = await api.get(`api/OffroadTrip/export-route-gpx/${trip.id}/${routeId}`, {
      responseType: 'blob',
    })
    downloadBlob(res.data, `route-${routeId}.gpx`)
  }

  const exportTripGpx = async () => {
    if (!trip) return
    const res = await api.get(`api/OffroadTrip/export-trip-gpx/${trip.id}`, { responseType: 'blob' })
    downloadBlob(res.data, `offroad-trip-${trip.id}.gpx`)
  }

  const requestMembership = async () => {
    if (!trip || !user?.id) return
    setIsJoining(true)
    setJoinError(null)
    try {
      await api.post('api/OffroadTrip/membership-request', {
        tripId: Number(trip.id),
        userId: user.id,
      })
      const res = await api.get(`api/OffroadTrip/get-offroad-trip/${trip.id}`)
      onTripUpdate(res.data)
    } catch (err) {
      setJoinError(getErrorMessage(err))
    } finally {
      setIsJoining(false)
    }
  }

  const respondToRequest = async (memberId: string, accept: boolean) => {
    if (!trip) return
    try {
      await api.patch('api/OffroadTrip/membership-response', {
        tripId: Number(trip.id),
        invitedId: Number(memberId),
        memberStatus: 'Requested',
        action: accept ? 'accept' : 'decline',
      })
      const res = await api.get(`api/OffroadTrip/get-offroad-trip/${trip.id}`)
      onTripUpdate(res.data)
    } catch (err) {
      console.error(getErrorMessage(err))
    }
  }

  const removeMember = async (memberId: string) => {
    if (!trip || !window.confirm('Are you sure you want to remove this member?')) return
    try {
      await api.delete(`api/OffroadTrip/remove-member/${trip.id}/${memberId}`)
      const res = await api.get(`api/OffroadTrip/get-offroad-trip/${trip.id}`)
      onTripUpdate(res.data)
    } catch (err) {
      console.error(getErrorMessage(err))
    }
  }

  const changeMemberRole = async (memberId: string, newRole: MemberRole) => {
    if (!trip) return
    try {
      await api.patch('api/OffroadTrip/change-role', {
        id: Number(memberId),
        tripId: Number(trip.id),
        role: newRole,
      })
      const res = await api.get(`api/OffroadTrip/get-offroad-trip/${trip.id}`)
      onTripUpdate(res.data)
    } catch (err) {
      console.error(getErrorMessage(err))
    }
  }

  const inviteMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trip || !inviteUsername.trim()) return
    setIsInviting(true)
    setInviteError(null)
    setInviteSuccess(null)
    try {
      await api.post('api/OffroadTrip/membership-request', {
        tripId: Number(trip.id),
        username: inviteUsername.trim(),
      })
      setInviteSuccess(`Invitation sent to ${inviteUsername}`)
      setInviteUsername('')
      const res = await api.get(`api/OffroadTrip/get-offroad-trip/${trip.id}`)
      onTripUpdate(res.data)
    } catch (err) {
      setInviteError(getErrorMessage(err))
    } finally {
      setIsInviting(false)
    }
  }

  const sortedMembers = [...(trip?.members ?? [])].sort((a, b) => {
    const statusOrder = { accepted: 0, pending: 1 }
    const aStatus = statusOrder[a.status as keyof typeof statusOrder] ?? 2
    const bStatus = statusOrder[b.status as keyof typeof statusOrder] ?? 2
    if (aStatus !== bStatus) return aStatus - bStatus
    return roleOrder[a.role as MemberRole] - roleOrder[b.role as MemberRole]
  })

  const totalKm = (trip?.routes ?? []).reduce((sum, r) => sum + r.distanceMeters, 0) / 1000

  return (
    <AnimatePresence>
      {isOpen && trip && (
        <Scrim
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <ModalCard
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader>
              <HeaderContent>
                <OffroadBadge>
                  <FiMap aria-hidden /> {getTripStatusLabel(trip.status)}
                </OffroadBadge>
                <ModalTitle>{trip.title}</ModalTitle>
                <ModalDescription>{trip.description}</ModalDescription>
                <ModalMeta>
                  <span>{formatDisplayDate(trip.startingDate)} – {formatDisplayDate(trip.endingDate)}</span>
                  <span>·</span>
                  <span>{trip.currentMembers}/{trip.maxParticipants} members</span>
                  <span>·</span>
                  <span>{trip.price} RON</span>
                  <span>·</span>
                  <span>{totalKm.toFixed(1)} km total</span>
                </ModalMeta>
              </HeaderContent>
              <CloseButton onClick={onClose}>
                <FiX />
              </CloseButton>
            </ModalHeader>

            {!isMember && (
              <JoinBanner>
                <p>Join this offroad adventure to access routes and chat with the crew.</p>
                <PrimaryBtn
                  onClick={requestMembership}
                  disabled={isJoining}
                >
                  {isJoining ? 'Requesting...' : 'Request to join'}
                </PrimaryBtn>
                {joinError && <ErrorText>{joinError}</ErrorText>}
              </JoinBanner>
            )}

            <TabsRow>
              <Tab
                $active={activeTab === 'details'}
                onClick={() => setActiveTab('details')}
              >
                <FiMap /> Routes
              </Tab>
              <Tab
                $active={activeTab === 'members'}
                onClick={() => setActiveTab('members')}
              >
                <FiUsers /> Members ({trip.members.length})
              </Tab>
              <Tab
                $active={activeTab === 'chat'}
                onClick={() => setActiveTab('chat')}
              >
                <FiMessageSquare /> Chat
              </Tab>
            </TabsRow>

            <ModalContent>
              {activeTab === 'details' && (
                <div>
                  <MapWrap>
                    <OffroadRouteMap routes={trip.routes} selectedRouteId={selectedRouteId} height="240px" />
                  </MapWrap>

                  <SectionHeader>
                    <h3>Trip Routes ({trip.routes.length})</h3>
                    {trip.routes.length > 0 && (
                      <GhostBtn onClick={exportTripGpx}>
                        <FiDownload /> Export all GPX
                      </GhostBtn>
                    )}
                  </SectionHeader>

                  {trip.routes.length === 0 ? (
                    <EmptyState>
                      <p>No routes yet. Import a GPX file or draw a track on the map.</p>
                      {isAdmin && (
                        <PrimaryLink to={`/app/offroad/${trip.id}/route/new`} onClick={onClose}>
                          <FiPlus /> Add first route
                        </PrimaryLink>
                      )}
                    </EmptyState>
                  ) : (
                    <RouteList>
                      {trip.routes.map((route) => (
                        <RouteCard
                          key={route.id}
                          $selected={selectedRouteId === route.id}
                        >
                          <RouteCardHeader>
                            <h4>{route.name}</h4>
                            <RouteSource $drawn={route.source === 'Drawn'}>
                              {route.source}
                            </RouteSource>
                          </RouteCardHeader>
                          <RouteMeta>
                            <span>Days <strong>{route.startDay}–{route.endDay}</strong></span>
                            <span><strong>{(route.distanceMeters / 1000).toFixed(1)} km</strong></span>
                            {route.elevationGainMeters > 0 && (
                              <span><strong>{Math.round(route.elevationGainMeters)} m</strong> elev.</span>
                            )}
                          </RouteMeta>
                          {route.note && <MutedText>{route.note}</MutedText>}
                          <RouteActions>
                            <GhostBtn onClick={() => setSelectedRouteId(route.id)}>
                              <span className="label-full">Show on map</span>
                              <span className="label-short">Map</span>
                            </GhostBtn>
                            <GhostBtn onClick={() => exportRouteGpx(route.id)}>
                              <FiDownload /> GPX
                            </GhostBtn>
                            {isAdmin && (
                              <>
                                <GhostLink
                                  to={`/app/offroad/${trip.id}/route/${route.id}/edit`}
                                  onClick={onClose}
                                >
                                  <FiEdit2 />
                                </GhostLink>
                                <GhostLink
                                  to={`/app/offroad/${trip.id}/route/${route.id}/edit`}
                                  onClick={onClose}
                                  $danger
                                >
                                  <FiTrash2 />
                                </GhostLink>
                              </>
                            )}
                          </RouteActions>
                        </RouteCard>
                      ))}
                    </RouteList>
                  )}

                  {isAdmin && trip.routes.length > 0 && (
                    <PrimaryLink
                      to={`/app/offroad/${trip.id}/route/new`}
                      onClick={onClose}
                    >
                      <FiPlus /> Add route
                    </PrimaryLink>
                  )}
                </div>
              )}

              {activeTab === 'members' && (
                <div>
                  {isAdmin && (
                    <InviteForm onSubmit={inviteMember}>
                      <h4>Invite Member</h4>
                      <InviteInputGroup>
                        <StyledInput
                          type="text"
                          placeholder="Enter username..."
                          value={inviteUsername}
                          onChange={(e) => setInviteUsername(e.target.value)}
                          disabled={isInviting}
                        />
                        <PrimaryBtn type="submit" disabled={isInviting || !inviteUsername.trim()}>
                          <FiUserPlus /> {isInviting ? 'Inviting...' : 'Invite'}
                        </PrimaryBtn>
                      </InviteInputGroup>
                      {inviteError && <ErrorText>{inviteError}</ErrorText>}
                      {inviteSuccess && <SuccessText>{inviteSuccess}</SuccessText>}
                    </InviteForm>
                  )}

                  {isAdmin && pendingRequests.length > 0 && (
                    <PendingSection>
                      <h4>Pending Requests ({pendingRequests.length})</h4>
                      {pendingRequests.map((member) => (
                        <MemberCard key={member.id} $pending>
                          <MemberInfo>
                            <MemberAvatar
                              src={getAvatarUrl(member.username, member.avatarUrl)}
                              alt={member.username}
                            />
                            <MemberNameGroup>
                              <strong>{member.username}</strong>
                              <MemberRole>Wants to join</MemberRole>
                            </MemberNameGroup>
                          </MemberInfo>
                          <MemberActions>
                            <PrimaryBtn onClick={() => respondToRequest(member.id, true)}>
                              <FiCheck /> Accept
                            </PrimaryBtn>
                            <GhostBtn onClick={() => respondToRequest(member.id, false)}>
                              <FiX /> Decline
                            </GhostBtn>
                          </MemberActions>
                        </MemberCard>
                      ))}
                    </PendingSection>
                  )}

                  <MembersSection>
                    <h4>Members</h4>
                    {sortedMembers
                      .filter((m) => m.status === 'accepted' || m.status === 'active')
                      .map((member) => (
                        <MemberCard key={member.id}>
                          <MemberInfo>
                            <MemberAvatar
                              src={getAvatarUrl(member.username, member.avatarUrl)}
                              alt={member.username}
                            />
                            <MemberNameGroup>
                              <strong>{member.username}</strong>
                              <MemberRole $role={member.role}>
                                {member.role}
                              </MemberRole>
                            </MemberNameGroup>
                          </MemberInfo>
                          <MemberActions>
                            {isOwner && member.role !== 'owner' && (
                              <StyledSelect
                                value={member.role}
                                onChange={(e) => changeMemberRole(member.id, e.target.value as MemberRole)}
                                title="Change role"
                              >
                                <option value="admin">Admin</option>
                                <option value="member">Member</option>
                              </StyledSelect>
                            )}
                            {((isOwner && member.role !== 'owner') || (isAdmin && member.role === 'member')) && (
                              <GhostBtn onClick={() => removeMember(member.id)} title="Remove member">
                                <FiTrash2 />
                              </GhostBtn>
                            )}
                          </MemberActions>
                        </MemberCard>
                      ))}
                  </MembersSection>
                </div>
              )}

              {activeTab === 'chat' && (
                <div>
                  {!isMember ? (
                    <ChatLocked>
                      <FiMessageSquare size={48} />
                      <p>Join this trip to access the crew chat.</p>
                      <PrimaryBtn
                        onClick={requestMembership}
                        disabled={isJoining}
                      >
                        {isJoining ? 'Requesting...' : 'Request to join'}
                      </PrimaryBtn>
                    </ChatLocked>
                  ) : (
                    <>
                      <ChatMessages>
                        {chatMessages.length === 0 ? (
                          <ChatEmpty>No messages yet. Say hello to the crew!</ChatEmpty>
                        ) : (
                          chatMessages.map((msg) => (
                            <ChatBubble
                              key={msg.id}
                              $self={msg.username === user?.username}
                            >
                              <ChatBubbleHeader>
                                <ChatAvatar
                                  src={getAvatarUrl(msg.username, msg.profileUrl)}
                                  alt={msg.username}
                                />
                                <strong>{msg.username}</strong>
                                <ChatTime>
                                  {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </ChatTime>
                              </ChatBubbleHeader>
                              <p>{msg.content}</p>
                            </ChatBubble>
                          ))
                        )}
                        <div ref={messagesEndRef} />
                      </ChatMessages>
                      <ChatCompose>
                        <StyledInput
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Message the crew..."
                          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                        />
                        <PrimaryBtn onClick={sendMessage} disabled={!newMessage.trim()}>
                          Send
                        </PrimaryBtn>
                      </ChatCompose>
                    </>
                  )}
                </div>
              )}
            </ModalContent>
          </ModalCard>
        </Scrim>
      )}
    </AnimatePresence>
  )
}
