import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { FiSend, FiMapPin, FiExternalLink, FiMessageCircle, FiArrowDown, FiLink, FiSearch, FiCpu, FiEdit3 } from 'react-icons/fi'
import { useSelector, useDispatch } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { setToken } from '../data/authSlice'
import * as signalR from '@microsoft/signalr'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styled, { keyframes } from 'styled-components'
import api from '../data/api'
import { parseAiLinks, parseAiMessage } from './aiAdvisorParsing'
import { getAvatarUrl } from '../utils/userUtils'
import { glassMorphism } from '../styles/mixins'
import type { User } from '../types/models'

interface AuthStoreState {
  auth: {
    user: User | null
    token: string | null
  }
}

type AiStatus = 'analyzing' | 'thinking' | 'searching_web' | 'writing' | 'validating_links' | null

interface Message {
  id: string
  text: string
  sender: 'user' | 'assistant'
  isComplete?: boolean
  status?: AiStatus
}

interface AiChatResponse {
  message: string
  role: string
  dateTime?: string
}

/* ------------------------------------------------------------------ */
/*  Styled Components                                                  */
/* ------------------------------------------------------------------ */

const Workspace = styled.section`
  display: flex;
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.bg[980]};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex-direction: column;
  }
`

const Sidebar = styled.aside`
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1.5rem 1.25rem;
  border-right: 1px solid ${({ theme }) => theme.glass.border};
  background: ${({ theme }) => theme.colors.bg[960]};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    display: none;
  }
`

const SidebarSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`

const SidebarHeading = styled.h3`
  font-size: ${({ theme }) => theme.typography.h3};
  color: ${({ theme }) => theme.colors.text[100]};
  margin: 0;
`

const SidebarDesc = styled.p`
  font-size: ${({ theme }) => theme.typography.bodySmall};
  color: ${({ theme }) => theme.colors.text[380]};
  line-height: 1.5;
  margin: 0;
`

const ToggleLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  user-select: none;
  padding: 0.5rem 0;
`

const ToggleTrack = styled.span`
  position: relative;
  width: 44px;
  height: 24px;
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.surface[820]};
  transition: background 0.25s;
  flex-shrink: 0;

  &::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    border-radius: ${({ theme }) => theme.radii.full};
    background: ${({ theme }) => theme.colors.text[100]};
    transition: transform 0.25s;
  }
`

const ToggleInput = styled.input`
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;

  &:checked + ${ToggleTrack} {
    background: ${({ theme }) => theme.colors.green[580]};
  }

  &:checked + ${ToggleTrack}::after {
    transform: translateX(20px);
  }
`

const ToggleText = styled.span`
  font-size: ${({ theme }) => theme.typography.bodySmall};
  color: ${({ theme }) => theme.colors.text[220]};
`

const SidebarFooter = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding-top: 1.5rem;
  border-top: 1px solid ${({ theme }) => theme.glass.border};
`

const SidebarSticker = styled.img`
  width: 80px;
  height: 80px;
  opacity: 0.6;
`

const SidebarEmptyNote = styled.p`
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[500]};
  text-align: center;
  margin: 0;
`

const ChatArea = styled.section`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  position: relative;
`

const Thread = styled.div`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1.5rem 1.5rem 0;
  scroll-behavior: smooth;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: 1rem 1rem 0;
  }
`

/* ---- Empty State ---- */

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 2rem;
  text-align: center;
`

const EmptyStateHeader = styled.header`
  margin-bottom: 2.5rem;
`

const EmptyStateTitle = styled.h1`
  font-size: ${({ theme }) => theme.typography.h1};
  color: ${({ theme }) => theme.colors.text[100]};
  margin: 0 0 0.5rem;
  font-weight: 700;
`

const EmptyStateSub = styled.p`
  font-size: ${({ theme }) => theme.typography.lead};
  color: ${({ theme }) => theme.colors.text[380]};
  margin: 0;
`

const SuggestionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  width: 100%;
  max-width: 640px;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
    max-width: 320px;
  }
`

const SuggestionCard = styled.button`
  ${glassMorphism()}
  border-radius: ${({ theme }) => theme.radii.xl};
  padding: 1.25rem 1rem;
  text-align: center;
  cursor: pointer;
  border: 1px solid ${({ theme }) => theme.glass.border};
  background: ${({ theme }) => theme.glass.bg};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: ${({ theme }) => theme.colors.text[100]};
  transition: all 0.25s;
  width: 100%;

  &:hover {
    border-color: ${({ theme }) => theme.colors.line};
    box-shadow: ${({ theme }) => theme.shadows.glow};
    transform: translateY(-2px);
  }
`

const SuggestionIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.radii.full};
  background: rgba(143, 179, 106, 0.1);
  color: ${({ theme }) => theme.colors.green[500]};
  font-size: 1.1rem;
`

const SuggestionTitle = styled.h4`
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  margin: 0;
  color: ${({ theme }) => theme.colors.text[100]};
`

const SuggestionDesc = styled.p`
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[500]};
  margin: 0;
`

/* ---- Messages ---- */

const MessagesContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-bottom: 1rem;
`

const MessageRow = styled.div<{ $sender: 'user' | 'assistant' }>`
  display: flex;
  justify-content: ${({ $sender }) => ($sender === 'user' ? 'flex-end' : 'flex-start')};
`

const MessageInner = styled.div<{ $sender: 'user' | 'assistant'; $thinking?: boolean }>`
  max-width: 80%;
  min-width: 120px;
  padding: 1rem 1.25rem;
  border-radius: ${({ theme }) => theme.radii.xl};
  border-bottom-right-radius: ${({ $sender, theme }) => ($sender === 'user' ? theme.radii.sm : theme.radii.xl)};
  border-bottom-left-radius: ${({ $sender, theme }) => ($sender === 'assistant' ? theme.radii.sm : theme.radii.xl)};
  background: ${({ $sender, theme }) => ($sender === 'user' ? `linear-gradient(140deg, ${theme.colors.green[580]}, ${theme.colors.green[700]})` : theme.glass.bg)};
  border: 1px solid ${({ $sender, theme }) => ($sender === 'user' ? 'transparent' : theme.glass.border)};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    max-width: 92%;
  }
`

const MessageHeader = styled.header`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`

const MessageAvatar = styled.img`
  width: 24px;
  height: 24px;
  border-radius: ${({ theme }) => theme.radii.full};
  object-fit: cover;
`

const MessageSenderName = styled.span`
  font-size: ${({ theme }) => theme.typography.caption};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text[220]};
`

const MessageContent = styled.div`
  font-size: ${({ theme }) => theme.typography.body};
  color: ${({ theme }) => theme.colors.text[100]};
  line-height: 1.6;
  word-break: break-word;

  p:first-child { margin-top: 0; }
  p:last-child { margin-bottom: 0; }

  a {
    color: ${({ theme }) => theme.colors.green[400]};
    text-decoration: underline;
  }

  code {
    background: rgba(143, 179, 106, 0.1);
    padding: 0.15em 0.4em;
    border-radius: ${({ theme }) => theme.radii.sm};
    font-size: 0.85em;
  }

  pre {
    background: rgba(0, 0, 0, 0.3);
    padding: 0.75rem;
    border-radius: ${({ theme }) => theme.radii.md};
    overflow-x: auto;
  }

  ul, ol {
    padding-left: 1.25rem;
  }
`

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
`

const StreamingContent = styled.div`
  white-space: pre-wrap;
`

const TypingCursor = styled.span`
  display: inline-block;
  width: 8px;
  height: 16px;
  background: ${({ theme }) => theme.colors.green[500]};
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: ${blink} 0.8s infinite;
`

const StreamStatus = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.5rem;
  padding: 0.35rem 0.7rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  background: rgba(143, 179, 106, 0.08);
  border: 1px solid rgba(143, 179, 106, 0.15);
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[380]};
`

const StreamStatusIcon = styled.span`
  display: flex;
  color: ${({ theme }) => theme.colors.green[500]};
`

const TripsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
  margin-top: 1rem;
`

const TripCard = styled(Link)`
  ${glassMorphism()}
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  text-decoration: none;
  color: ${({ theme }) => theme.colors.text[100]};
  border: 1px solid ${({ theme }) => theme.glass.border};
  transition: all 0.2s;

  &:hover {
    border-color: ${({ theme }) => theme.colors.line};
    box-shadow: ${({ theme }) => theme.shadows.glow};
    transform: translateY(-1px);
  }
`

const TripBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: ${({ theme }) => theme.typography.eyebrow};
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.green[500]};
`

const TripTitle = styled.h4`
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  margin: 0;
  line-height: 1.4;
`

const TripExploreBtn = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[380]};
  margin-top: auto;
`

const LinksGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
`

const LinkCard = styled.a`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.85rem;
  border-radius: ${({ theme }) => theme.radii.md};
  background: rgba(143, 179, 106, 0.04);
  border: 1px solid ${({ theme }) => theme.glass.border};
  text-decoration: none;
  color: ${({ theme }) => theme.colors.text[100]};
  transition: all 0.2s;

  &:hover {
    background: rgba(143, 179, 106, 0.08);
    border-color: ${({ theme }) => theme.colors.line};
  }
`

const LinkIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.radii.md};
  background: rgba(143, 179, 106, 0.1);
  color: ${({ theme }) => theme.colors.green[500]};
  flex-shrink: 0;
`

const LinkBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  flex: 1;
`

const LinkTitle = styled.h4`
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  margin: 0;
  color: ${({ theme }) => theme.colors.text[100]};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const LinkUrl = styled.span`
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[500]};
`

const LinkArrow = styled.div`
  color: ${({ theme }) => theme.colors.text[500]};
  flex-shrink: 0;
`

/* ---- Thinking Dots ---- */

const dotPulse = keyframes`
  0%, 80%, 100% { transform: scale(0.5); opacity: 0.3; }
  40% { transform: scale(1); opacity: 1; }
`

const ThinkingDots = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;

  span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.green[500]};
    display: inline-block;
  }

  span:nth-child(1) { animation: ${dotPulse} 1.2s ease-in-out infinite; }
  span:nth-child(2) { animation: ${dotPulse} 1.2s ease-in-out 0.2s infinite; }
  span:nth-child(3) { animation: ${dotPulse} 1.2s ease-in-out 0.4s infinite; }
`

const ThinkingLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.caption};
  color: ${({ theme }) => theme.colors.text[380]};
  display: flex;
  align-items: center;
  gap: 0.35rem;
`

const ThinkingBody = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
`

/* ---- Scroll Button ---- */

const ScrollButton = styled.button`
  position: absolute;
  bottom: 110px;
  right: 2rem;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ theme }) => theme.glass.bgStrong};
  border: 1px solid ${({ theme }) => theme.glass.border};
  color: ${({ theme }) => theme.colors.text[100]};
  cursor: pointer;
  box-shadow: ${({ theme }) => theme.shadows.md};
  backdrop-filter: blur(12px);
  transition: all 0.2s;

  &:hover {
    border-color: ${({ theme }) => theme.colors.line};
    transform: translateY(-2px);
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    right: 1rem;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 5.5rem);
  }
`

/* ---- Composer ---- */

const ComposerShell = styled.div`
  flex-shrink: 0;
  padding: 0.75rem 1.5rem 1rem;
  border-top: 1px solid ${({ theme }) => theme.glass.border};
  background: ${({ theme }) => theme.colors.bg[960]};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: 0.5rem 1rem 0.75rem;
  }
`

const ComposerForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const ComposerInputWrapper = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
`

const ComposerTextarea = styled.textarea`
  flex: 1;
  resize: none;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 0.75rem 1rem;
  border-radius: ${({ theme }) => theme.radii.xl};
  border: 1px solid ${({ theme }) => theme.glass.border};
  background: ${({ theme }) => theme.glass.bg};
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.body};
  font-family: inherit;
  line-height: 1.5;
  max-height: 140px;
  min-height: 44px;
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  transition: border-color 0.2s;

  &::-webkit-scrollbar {
    display: none;
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.text[500]};
  }

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.green[500]};
    box-shadow: 0 0 0 3px rgba(143, 179, 106, 0.1);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const ComposerSubmit = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ theme }) => theme.colors.green[580]};
  border: none;
  color: #10120f;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.green[500]};
    box-shadow: 0 0 16px rgba(143, 179, 106, 0.2);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`

const ComposerFooter = styled.p`
  font-size: ${({ theme }) => theme.typography.eyebrow};
  color: ${({ theme }) => theme.colors.text[500]};
  text-align: center;
  margin: 0;
  user-select: none;
`

/* ---- Offline State ---- */

const OfflineWrapper = styled.section`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60vh;
  text-align: center;
  padding: 2rem;
`

const OfflineInner = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  max-width: 400px;
`

const OfflineIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: ${({ theme }) => theme.radii.full};
  background: rgba(219, 74, 91, 0.1);
  color: ${({ theme }) => theme.colors.danger[500]};
  font-size: 1.4rem;
`

const OfflineTitle = styled.h2`
  font-size: ${({ theme }) => theme.typography.h2};
  color: ${({ theme }) => theme.colors.text[100]};
  margin: 0;
`

const OfflineText = styled.p`
  font-size: ${({ theme }) => theme.typography.body};
  color: ${({ theme }) => theme.colors.text[380]};
  margin: 0;
  line-height: 1.6;
`

const OfflineLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.65rem 1.5rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: #10120f;
  font-weight: 600;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  text-decoration: none;
  margin-top: 0.5rem;
  transition: all 0.2s;

  &:hover {
    box-shadow: 0 0 30px rgba(143, 179, 106, 0.2);
    transform: translateY(-1px);
  }
`

/* ------------------------------------------------------------------ */
/*  StreamingMessage                                                   */
/* ------------------------------------------------------------------ */

const StreamingMessage = ({ text, isStreaming }: { text: string; isStreaming?: boolean }) => {
  if (isStreaming) {
    return (
      <StreamingContent>
        <span>{text}</span>
        <TypingCursor />
      </StreamingContent>
    )
  }

  return (
    <MessageContent>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </MessageContent>
  )
}

/* ------------------------------------------------------------------ */
/*  OfflineAiState                                                     */
/* ------------------------------------------------------------------ */

function OfflineAiState() {
  return (
    <OfflineWrapper>
      <OfflineInner>
        <OfflineIcon>
          <FiMessageCircle />
        </OfflineIcon>
        <OfflineTitle>AI is sleeping...</OfflineTitle>
        <OfflineText>
          Sorry, but the AI Assistant isn't available offline. Please reconnect to your signal to continue the conversation.
        </OfflineText>
        <OfflineLink to="/app">Go to discovery</OfflineLink>
      </OfflineInner>
    </OfflineWrapper>
  )
}

/* ------------------------------------------------------------------ */
/*  AiAdvisorPage                                                      */
/* ------------------------------------------------------------------ */

export function AiAdvisorPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const token = useSelector((state: AuthStoreState) => state.auth.token)
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const [prompt, setPrompt] = useState('')
  const baseURL = import.meta.env.VITE_BASE_URL
  const [preferProfile, setPreferProfile] = useState(true)
  const [isTyping, setIsTyping] = useState(false)
  const [aiStatus, setAiStatus] = useState<AiStatus>(null)
  const statusLabelMap: Record<Exclude<AiStatus, null>, { icon: React.ReactNode; label: string }> = {
    analyzing: { icon: <FiCpu size={12} />, label: 'Analyzing your profile...' },
    thinking: { icon: <FiCpu size={12} />, label: 'Thinking...' },
    searching_web: { icon: <FiSearch size={12} />, label: 'Searching the internet...' },
    writing: { icon: <FiEdit3 size={12} />, label: 'Writing response...' },
    validating_links: { icon: <FiLink size={12} />, label: 'Checking links...' },
  }
  const [activeAiMessageId, setActiveAiMessageId] = useState<string | null>(null)
  const connectionRef = useRef<signalR.HubConnection | null>(null)
  const aiMessageIdRef = useRef<string | null>(null)
  const isSendingRef = useRef(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const initialScrollDone = useRef(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const threadRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [prompt])

  const fetchChatHistory = async () => {
    try {
      const res = await api.get<AiChatResponse[]>('/api/ai/history')
      const historyMessages: Message[] = []
      for (let i = 0; i < res.data.length; i++) {
        const item = res.data[i]
        const sender = item.role.toLowerCase() === 'user' ? 'user' : 'assistant'
        const prev = historyMessages[historyMessages.length - 1]
        if (prev && prev.sender === sender && prev.text === item.message) continue

        historyMessages.push({
          id: item.dateTime ? `hist-${item.dateTime}` : `hist-${i}-${sender}`,
          text: item.message,
          sender,
          isComplete: true,
        })
      }

      setMessages(historyMessages)
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    if (!threadRef.current) {
      return
    }
    const refreshToken = async () => {
      if (!navigator.onLine) return
      try {
        const res = await api.post('api/auth/refresh')
        dispatch(setToken({ token: res.data.token }))
      } catch {
        navigate('/login', { replace: true })
      }
    }
    if (!token) {
      refreshToken()
    }

    setIsTyping(false)
    setActiveAiMessageId(null)
    aiMessageIdRef.current = null

    if (!token) return

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${baseURL}/hubs/ai-chat?access_token=${token}`)
      .withAutomaticReconnect([1000, 2000, 5000, 10000, 30000])
      .build()

    connection.on('StartAiMessage', () => {
      const id = crypto.randomUUID()
      setMessages((prev) => [...prev, { id, text: '', sender: 'assistant', isComplete: false }])
      aiMessageIdRef.current = id
      setActiveAiMessageId(id)
    })

    connection.on('ReceiveAiChunk', (chunk: string) => {
      const id = aiMessageIdRef.current
      setMessages((prev) => {
        const index = prev.findIndex((m) => m.id === id)
        if (index === -1) return prev

        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          text: updated[index].text + chunk,
        }
        return updated
      })
    })

    connection.on('StatusUpdate', (status: AiStatus) => {
      setAiStatus(status)
      const id = aiMessageIdRef.current
      if (id) {
        setMessages((prev) => {
          const index = prev.findIndex((m) => m.id === id)
          if (index === -1) return prev
          const updated = [...prev]
          updated[index] = { ...updated[index], status }
          return updated
        })
      }
    })

    connection.on('FinalizeAiMessage', (finalText: string) => {
      const id = aiMessageIdRef.current
      if (!id) return
      setMessages((prev) => {
        const index = prev.findIndex((m) => m.id === id)
        if (index === -1) return prev
        const updated = [...prev]
        updated[index] = { ...updated[index], text: finalText, status: undefined }
        return updated
      })
    })

    connection.on('EndAiMessage', () => {
      const id = aiMessageIdRef.current
      setMessages((prev) => {
        const index = prev.findIndex((m) => m.id === id)
        if (index === -1) return prev
        const updated = [...prev]
        updated[index] = { ...updated[index], isComplete: true }
        return updated
      })
      aiMessageIdRef.current = null
      setActiveAiMessageId(null)
      setIsTyping(false)
      setAiStatus(null)
    })

    connection.onreconnecting((error) => {
      console.warn('SignalR Reconnecting:', error)
      setIsTyping(false)
      setActiveAiMessageId(null)
      setAiStatus(null)
    })

    connection.onreconnected((connectionId) => {
      console.log('SignalR Reconnected. Connection ID:', connectionId)
    })

    connection.onclose((error) => {
      console.error('SignalR Connection Closed:', error)
      setIsTyping(false)
      setActiveAiMessageId(null)
      setAiStatus(null)
    })

    connectionRef.current = connection

    let isStopped = false
    const start = async () => {
      try {
        await connection.start()
        if (!isStopped) {
          await connection.invoke('JoinAiChat')
        }
      } catch (error) {
        console.error('SignalR Connection Error:', error)
      }
    }
    start()

    return () => {
      isStopped = true
      const stop = async () => {
        try {
          if (connection.state === signalR.HubConnectionState.Connected) {
            await connection.invoke('LeaveAiChat')
          }
        } catch (error) {
          console.log('LeaveAiChat Error:', error)
        }
        await connection.stop()
      }
      stop()
      connectionRef.current = null
    }
  }, [token, baseURL, dispatch, navigate])

  useEffect(() => {
    if (!token) {
      return
    }
    const loadHistory = async () => {
      await fetchChatHistory()
    }
    void loadHistory()
  }, [token])

  const handleScroll = () => {
    const thread = threadRef.current
    if (thread) {
      const isAtBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 150
      setShowScrollButton(!isAtBottom && thread.scrollHeight > thread.clientHeight)
    }
  }

  const scrollToBottom = () => {
    const thread = threadRef.current
    if (thread) {
      thread.scrollTo({
        top: thread.scrollHeight,
        behavior: 'smooth',
      })
    }
  }

  useEffect(() => {
    const thread = threadRef.current
    if (thread && messages.length > 0) {
      if (!initialScrollDone.current) {
        thread.scrollTop = thread.scrollHeight
        initialScrollDone.current = true
      } else {
        const isAtBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 250
        if (isAtBottom) {
          thread.scrollTop = thread.scrollHeight
        }
      }
      handleScroll()
    }
  }, [messages, isTyping])

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault()

    if (!prompt.trim() || isTyping || activeAiMessageId || isSendingRef.current) return

    const text = prompt.trim()
    isSendingRef.current = true

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), text, sender: 'user', isComplete: true }])

    setPrompt('')
    setIsTyping(true)

    try {
      await connectionRef.current?.invoke('SendAiMessage', text, preferProfile)
    } catch (err) {
      console.error(err)
      setIsTyping(false)
      setActiveAiMessageId(null)
      aiMessageIdRef.current = null
    } finally {
      isSendingRef.current = false
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  if (isOffline) {
    return <OfflineAiState />
  }

  return (
    <Workspace>
      <Sidebar>
        <SidebarSection>
          <SidebarHeading>Configuration</SidebarHeading>
          <SidebarDesc>Refine how the AI interprets your profile data.</SidebarDesc>
          <ToggleLabel>
            <ToggleInput
              type="checkbox"
              checked={preferProfile}
              onChange={(event) => setPreferProfile(event.target.checked)}
            />
            <ToggleTrack />
            <ToggleText>Personalized Matching</ToggleText>
          </ToggleLabel>
        </SidebarSection>

        <SidebarFooter>
          <SidebarSticker src="/newstickers/sticker6.png" alt="" />
          <SidebarEmptyNote>AI Intelligence is active and ready.</SidebarEmptyNote>
        </SidebarFooter>
      </Sidebar>

      <ChatArea>
        <Thread ref={threadRef} data-lenis-prevent onScroll={handleScroll}>
          {messages.length === 0 && !isTyping ? (
            <EmptyState>
              <EmptyStateHeader>
                <EmptyStateTitle>Where are we heading next?</EmptyStateTitle>
                <EmptyStateSub>I'm your TripGenius AI. Ask me about itineraries, hidden gems, or group planning.</EmptyStateSub>
              </EmptyStateHeader>

              <SuggestionsGrid>
                <SuggestionCard onClick={() => setPrompt('Plan a 3-day trip to Tokyo for a group of 5')}>
                  <SuggestionIcon><FiMapPin /></SuggestionIcon>
                  <SuggestionTitle>Group Itineraries</SuggestionTitle>
                  <SuggestionDesc>Tokyo for a group of 5</SuggestionDesc>
                </SuggestionCard>
                <SuggestionCard onClick={() => setPrompt('Suggest some hidden gems in Iceland')}>
                  <SuggestionIcon><FiExternalLink /></SuggestionIcon>
                  <SuggestionTitle>Hidden Gems</SuggestionTitle>
                  <SuggestionDesc>Unexplored spots in Iceland</SuggestionDesc>
                </SuggestionCard>
                <SuggestionCard onClick={() => setPrompt('Recommend a beach trip based on my style')}>
                  <SuggestionIcon><FiSend /></SuggestionIcon>
                  <SuggestionTitle>Style Matching</SuggestionTitle>
                  <SuggestionDesc>Beaches based on my profile</SuggestionDesc>
                </SuggestionCard>
              </SuggestionsGrid>
            </EmptyState>
          ) : (
            <MessagesContainer>
              {messages.map((message) => (
                <MessageRow key={message.id} $sender={message.sender}>
                  <MessageInner $sender={message.sender}>
                    <MessageHeader>
                      <MessageAvatar
                        src={message.sender === 'user' ? getAvatarUrl(user?.username, user?.profileUrl) : '/newstickers/sticker1.png'}
                        alt=""
                      />
                      <MessageSenderName>
                        {message.sender === 'user' ? (user?.username || 'Explorer') : 'TripGenius AI'}
                      </MessageSenderName>
                    </MessageHeader>

                    {message.sender === 'assistant'
                      ? (() => {
                          const withLinks = parseAiLinks(message.text)
                          const parsed = parseAiMessage(withLinks.text)
                          const links = withLinks.links
                          return (
                            <>
                              <StreamingMessage
                                text={parsed.text}
                                isStreaming={!message.isComplete && activeAiMessageId === message.id}
                              />
                              {!message.isComplete && message.status && statusLabelMap[message.status] && (
                                <StreamStatus>
                                  <StreamStatusIcon>{statusLabelMap[message.status].icon}</StreamStatusIcon>
                                  {statusLabelMap[message.status].label}
                                </StreamStatus>
                              )}
                              {parsed.trips && parsed.trips.length > 0 && (
                                <TripsGrid>
                                  {parsed.trips.map((trip) => (
                                    <TripCard
                                      key={trip.id}
                                      to={trip.type === 'offroad' ? `/app/offroad/${trip.id}` : `/app/trip/${trip.id}`}
                                    >
                                      <TripBadge>
                                        <FiMapPin size={12} /> {trip.type === 'offroad' ? 'Offroad' : 'AI Match'}
                                      </TripBadge>
                                      <TripTitle>{trip.title}</TripTitle>
                                      <TripExploreBtn>
                                        <span>Explore</span>
                                        <FiExternalLink size={14} />
                                      </TripExploreBtn>
                                    </TripCard>
                                  ))}
                                </TripsGrid>
                              )}
                              {message.isComplete && links.length > 0 && (
                                <LinksGrid>
                                  {links
                                    .filter((link) => {
                                      try {
                                        return !!link.url && !!new URL(link.url).hostname
                                      } catch {
                                        return false
                                      }
                                    })
                                    .map((link, i) => (
                                      <LinkCard key={i} href={link.url} target="_blank" rel="noopener noreferrer">
                                        <LinkIcon>
                                          <FiLink size={14} />
                                        </LinkIcon>
                                        <LinkBody>
                                          <LinkTitle>{link.title}</LinkTitle>
                                          <LinkUrl>{new URL(link.url).hostname.replace('www.', '')}</LinkUrl>
                                        </LinkBody>
                                        <LinkArrow>
                                          <FiExternalLink size={14} />
                                        </LinkArrow>
                                      </LinkCard>
                                    ))}
                                </LinksGrid>
                              )}
                            </>
                          )
                        })()
                      : (
                        <MessageContent>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                        </MessageContent>
                      )}
                  </MessageInner>
                </MessageRow>
              ))}
              {isTyping && !activeAiMessageId && (
                <MessageRow $sender="assistant">
                  <MessageInner $sender="assistant" $thinking>
                    <MessageHeader>
                      <MessageAvatar src="/newstickers/sticker1.png" alt="" />
                      <MessageSenderName>TripGenius AI</MessageSenderName>
                    </MessageHeader>
                    <ThinkingBody>
                      <ThinkingDots>
                        <span />
                        <span />
                        <span />
                      </ThinkingDots>
                      <ThinkingLabel>
                        {aiStatus && statusLabelMap[aiStatus]
                          ? <>{statusLabelMap[aiStatus].icon} {statusLabelMap[aiStatus].label}</>
                          : 'AI is thinking'}
                      </ThinkingLabel>
                    </ThinkingBody>
                  </MessageInner>
                </MessageRow>
              )}
            </MessagesContainer>
          )}
        </Thread>

        {showScrollButton && (
          <ScrollButton onClick={scrollToBottom} aria-label="Scroll to bottom">
            <FiArrowDown />
          </ScrollButton>
        )}

        <ComposerShell>
          <ComposerForm onSubmit={handleSubmit}>
            <ComposerInputWrapper>
              <ComposerTextarea
                ref={textareaRef}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isTyping ? 'Formulating strategy...' : 'Ask me anything...'}
                disabled={isTyping}
                rows={1}
              />
              <ComposerSubmit
                type="submit"
                disabled={isTyping || !!activeAiMessageId || !prompt.trim()}
                aria-label="Send message"
              >
                <FiSend />
              </ComposerSubmit>
            </ComposerInputWrapper>
            <ComposerFooter>TripGenius AI can make mistakes. Verify important info.</ComposerFooter>
          </ComposerForm>
        </ComposerShell>
      </ChatArea>
    </Workspace>
  )
}
