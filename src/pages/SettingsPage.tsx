import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import {
  FiAlertTriangle,
  FiMail,
  FiShield,
  FiMessageSquare,
  FiChevronRight,
  FiChevronLeft,
  FiUser,
  FiHelpCircle,
  FiTrash2,
  FiLogOut
} from 'react-icons/fi'
import type { User } from '../types/models'
import api from '../data/api'
import { useDispatch, useSelector } from 'react-redux'
import { setUser, logout as logoutAction } from '../data/authSlice'
import { ToastContainer } from '../components/shared/Toast'
import { useToast } from '../components/shared/useToast'
import waitForBackendButtonUnlock from '../utils/interactionDelay'

import { AxiosError } from 'axios'
import { isQueuedRequestError } from '../utils/errorMessage'

interface AuthStoreState {
  auth: {
    user: User | null
    token: string | null
  }
}

type SettingsTab = 'account' | 'security' | 'support' | 'danger'

const settingsTabs: Array<{ key: SettingsTab; label: string; Icon: React.ComponentType<{ className?: string; size?: number }> }> = [
  { key: 'account', label: 'Account', Icon: FiUser },
  { key: 'security', label: 'Security', Icon: FiShield },
  { key: 'support', label: 'Support', Icon: FiHelpCircle },
  { key: 'danger', label: 'Danger zone', Icon: FiTrash2 },
]

const revealTransition = {
  duration: 0.58,
  ease: [0.22, 1, 0.36, 1] as const,
}

const Page = styled.section`
  width: min(800px, 100% - 2rem);
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
  border-radius: ${({ theme }) => theme.radii.lg};
  transition: all ${({ theme }) => theme.animation.duration.normal}s;
  min-height: 44px;
  min-width: 44px;
  white-space: nowrap;
  text-decoration: none;
  line-height: 1;
  padding: 0.65rem 1.5rem;
  background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: #ffffff;
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};

  &:hover {
    background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[500]}, ${({ theme }) => theme.colors.green[300]});
    transform: translateY(-1px);
    box-shadow: 0 0 40px rgba(46, 141, 84, 0.3), 0 0 80px rgba(46, 141, 84, 0.1);
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

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
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

const BackButton = styled.button`
  width: 40px;
  height: 40px;
  background: rgba(28, 43, 32, 0.05);
  border: none;
  border-radius: ${({ theme }) => theme.radii.lg};
  color: ${({ theme }) => theme.colors.text[220]};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;

  &:hover {
    background: rgba(28, 43, 32, 0.1);
    color: ${({ theme }) => theme.colors.text[100]};
  }
`

const TabList = styled.nav`
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineSoft};
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
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.2s ease;
  min-height: 40px;
  font-family: inherit;

  &:hover {
    color: ${({ theme }) => theme.colors.text[220]};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

const MobileMenu = styled(motion.div)`
  display: grid;
  gap: 0.75rem;
`

const MenuCard = styled.button<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  text-align: left;
  width: 100%;
  background: ${({ $danger }) => ($danger ? 'rgba(219, 74, 91, 0.1)' : 'rgba(255, 255, 255, 0.4)')};
  border: 1px solid ${({ $danger, theme }) => ($danger ? 'rgba(219, 74, 91, 0.2)' : theme.glass.border)};
  border-radius: ${({ theme }) => theme.radii.xl};
  cursor: pointer;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text[100]};
  transition: background 0.2s ease, border-color 0.2s ease;

  &:hover {
    background: ${({ $danger }) => ($danger ? 'rgba(219, 74, 91, 0.15)' : 'rgba(255, 255, 255, 0.55)')};
  }
`

const MenuCardLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`

const MenuCardLabel = styled.span<{ $danger?: boolean }>`
  font-weight: 600;
  font-size: 1.05rem;
  color: ${({ $danger, theme }) => ($danger ? theme.colors.danger[500] : theme.colors.text[100])};
`

const FooterInfo = styled.div`
  text-align: center;
  margin-top: 2rem;
  opacity: 0.4;
`

const FooterSticker = styled.img`
  width: 100px;
`

const FooterVersion = styled.p`
  font-size: 0.8rem;
  margin-top: 1rem;
  color: ${({ theme }) => theme.colors.text[380]};
`

const ContentPanel = styled(motion.div)`
  display: grid;
  gap: ${({ theme }) => theme.spacing.lg};
`

const Card = styled.div<{ $danger?: boolean }>`
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ $danger, theme }) => ($danger ? 'rgba(219, 74, 91, 0.3)' : theme.glass.border)};
  border-radius: ${({ theme }) => theme.radii.xl};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  -webkit-backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  overflow: hidden;
`

const CardContent = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.xl};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex-direction: column;
    padding: ${({ theme }) => theme.spacing.lg};
  }
`

const IconCircle = styled.div<{ $danger?: boolean }>`
  width: 44px;
  height: 44px;
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ $danger }) => ($danger ? 'rgba(219, 74, 91, 0.15)' : 'rgba(46, 141, 84, 0.12)')};
  color: ${({ $danger, theme }) => ($danger ? theme.colors.danger[500] : theme.colors.green[580])};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15rem;
  flex-shrink: 0;
`

const CardBody = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`

const CardTitle = styled.h3<{ $danger?: boolean }>`
  font-size: ${({ theme }) => theme.typography.h3};
  color: ${({ $danger, theme }) => ($danger ? theme.colors.danger[500] : theme.colors.text[100])};
`

const CardDesc = styled.p`
  font-size: ${({ theme }) => theme.typography.body};
  color: ${({ theme }) => theme.colors.text[380]};
  line-height: 1.5;
`

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.lg};
`

const FieldLabel = styled.label`
  font-size: ${({ theme }) => theme.typography.eyebrow};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.text[500]};
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
    box-shadow: 0 0 0 3px rgba(46, 141, 84, 0.1);
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
    box-shadow: 0 0 0 3px rgba(46, 141, 84, 0.1);
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
  border-radius: ${({ theme }) => theme.radii.lg};
  transition: all ${({ theme }) => theme.animation.duration.normal}s;
  min-height: 44px;
  min-width: 44px;
  white-space: nowrap;
  line-height: 1;
  padding: 0.65rem 1.5rem;
  background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: #ffffff;
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};
  border: none;
  cursor: pointer;
  align-self: flex-start;

  &:hover {
    background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[500]}, ${({ theme }) => theme.colors.green[300]});
    transform: translateY(-1px);
    box-shadow: 0 0 40px rgba(46, 141, 84, 0.3), 0 0 80px rgba(46, 141, 84, 0.1);
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

const DangerBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  font-family: inherit;
  border-radius: ${({ theme }) => theme.radii.lg};
  transition: all ${({ theme }) => theme.animation.duration.normal}s;
  min-height: 44px;
  min-width: 44px;
  white-space: nowrap;
  line-height: 1;
  padding: 0.65rem 1.5rem;
  background: linear-gradient(140deg, ${({ theme }) => theme.colors.danger[500]}, ${({ theme }) => theme.colors.danger[400]});
  color: #fff;
  border: none;
  cursor: pointer;
  box-shadow: 0 0 24px rgba(219, 74, 91, 0.25);
  font-size: ${({ theme }) => theme.typography.bodySmall};

  &:hover {
    background: linear-gradient(140deg, ${({ theme }) => theme.colors.danger[400]}, ${({ theme }) => theme.colors.danger[500]});
    transform: translateY(-1px);
    box-shadow: 0 0 36px rgba(219, 74, 91, 0.35);
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

const SectionInner = styled.div`
  background: transparent;
  padding: 0;
  border: none;
`

const CornerSticker = styled.div`
  text-align: center;
  opacity: 0.6;
`

const CornerStickerImg = styled.img`
  width: 120px;
`

const DangerSticker = styled.div`
  text-align: center;
  opacity: 0.4;
`

const DangerStickerImg = styled.img`
  width: 150px;
`

export function SettingsPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const [searchParams, setSearchParams] = useSearchParams()
  const tabListRef = useRef<HTMLElement | null>(null)
  const requestedTab = searchParams.get('tab')

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 850)

  const activeTab: SettingsTab | 'menu' =
    requestedTab && settingsTabs.some((tab) => tab.key === requestedTab)
      ? (requestedTab as SettingsTab)
      : (isMobile ? 'menu' : 'account')

  const [email, setEmail] = useState(user?.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [bugReport, setBugReport] = useState('')
  const { toasts, addToast, removeToast } = useToast()
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [isReportingBug, setIsReportingBug] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const isBackendActionLocked = isUpdatingEmail || isUpdatingPassword || isDeletingAccount || isReportingBug || isLoggingOut
  const shouldRedirectToLogin = !user

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 850)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
  }, [shouldRedirectToLogin, navigate, addToast])

  if (!user) {
    return (
      <Page>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <UnauthedWrapper>
          <UnauthedSticker src="/newstickers/sticker5.png" alt="" />
          <UnauthedTitle>You are not logged in</UnauthedTitle>
          <UnauthedDesc>Log in to manage your account details and security settings.</UnauthedDesc>
          <UnauthedLink to="/login">
            Go to login
          </UnauthedLink>
        </UnauthedWrapper>
      </Page>
    )
  }

  const selectTab = (nextTab: SettingsTab | 'menu') => {
    const nextParams = new URLSearchParams(searchParams)
    if (nextTab === 'menu') {
      nextParams.delete('tab')
    } else {
      nextParams.set('tab', nextTab)
    }
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
      nextIndex = (currentIndex + 1) % settingsTabs.length
    }

    if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + settingsTabs.length) % settingsTabs.length
    }

    if (event.key === 'Home') {
      nextIndex = 0
    }

    if (event.key === 'End') {
      nextIndex = settingsTabs.length - 1
    }

    if (nextIndex === null) {
      return
    }

    event.preventDefault()
    const nextTab = settingsTabs[nextIndex]
    selectTab(nextTab.key)
    focusTabAt(nextIndex)
  }

  const changeEmail = async (newEmail: string) => {
    const res = await api.patch('api/user/change-mail', { newEmail })
    console.log(res)
    const newUser = await api.get('api/user/me')
    dispatch(setUser({ user: newUser.data }))
  }

  const updateEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isUpdatingEmail || isDeletingAccount || isReportingBug) {
      return
    }

    setIsUpdatingEmail(true)

    try {
      await changeEmail(email)
      addToast('Email updated successfully.', 'success')
    }
    catch (err: unknown) {
      if (isQueuedRequestError(err)) {
        addToast('Email update will be synchronized when online.', 'success')
      }
      else if (err instanceof AxiosError) {
        console.log(err.response)
        const message = err.response?.data?.message || err.response?.data || "Email change failed"
        addToast(String(message), 'error')
      }
      else {
        addToast('Email change failed.', 'error')
      }
    }
    finally {
      await waitForBackendButtonUnlock()
      setIsUpdatingEmail(false)
    }
  }

  const changePassword = async (oldPassword: string, newPassword: string) => {
    await api.patch("api/user/change-password", { oldPassword, newPassword })
  }

  const updatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isUpdatingPassword || isDeletingAccount || isReportingBug) {
      return
    }

    setIsUpdatingPassword(true)

    try {
      await changePassword(currentPassword, nextPassword)
      addToast('Password changed successfully.', 'success')
      setCurrentPassword('')
      setNextPassword('')
    }
    catch (err: unknown) {
      if (isQueuedRequestError(err)) {
        addToast('Password change will be synchronized when online.', 'success')
        setCurrentPassword('')
        setNextPassword('')
      }
      else if (err instanceof AxiosError) {
        const message = err.response?.data?.message || err.response?.data || "Password change failed"
        addToast(String(message), 'error')
      }
    }
    finally {
      await waitForBackendButtonUnlock()
      setIsUpdatingPassword(false)
    }
  }

  const reportBug = async (description: string) => {
    await api.post('api/bug/bug-report', { description: description })
  }

  const reportBugSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isDeletingAccount || isUpdatingEmail || isUpdatingPassword) {
      return
    }
    setIsReportingBug(true)
    try {
      await reportBug(bugReport)
      addToast('Bug report received. Thank you for helping improve TripGenius.', 'info')
      setBugReport('')
    }
    catch (err: unknown) {
      if (isQueuedRequestError(err)) {
        addToast('Bug report will be sent when online.', 'success')
        setBugReport('')
      }
      else if (err instanceof AxiosError) {
        const message = err.response?.data?.message || err.response?.data || "Bug report failed"
        addToast(String(message), 'error')
      }
    }
    finally {
      await waitForBackendButtonUnlock()
      setIsReportingBug(false)
    }

  }

  const deleteAccount = async () => {
    if (isBackendActionLocked) {
      return
    }

    setIsDeletingAccount(true)
    let shouldNavigate = false

    try {
      await api.delete("api/user/delete-account")
      addToast('Account deleted. Redirecting to login...', 'success')
      shouldNavigate = true
    }
    catch (err: unknown) {
      if (isQueuedRequestError(err)) {
        addToast('Account deletion will be processed when online.', 'success')
      }
      else if (err instanceof AxiosError) {
        console.log(err.response)
        const message = err.response?.data?.message || err.response?.data || "Account deletion failed"
        addToast(String(message), 'error')
      }
      else {
        addToast('Account deletion failed.', 'error')
      }
    }
    finally {
      await waitForBackendButtonUnlock()
      setIsDeletingAccount(false)
    }

    if (shouldNavigate) {
      dispatch(logoutAction())
      navigate('/login', { replace: true })
    }
  }

  const handleLogout = async () => {
    if (isLoggingOut) {
      return
    }

    setIsLoggingOut(true)

    try {
      await api.post('/api/auth/logout')
    } finally {
      dispatch(logoutAction())
      setIsLoggingOut(false)
      navigate('/login', { replace: true })
    }
  }


  return (
    <Page>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <Header>
        <HeaderLeft>
          {isMobile && activeTab !== 'menu' && (
            <BackButton
              onClick={() => selectTab('menu')}
              aria-label="Back to settings menu"
            >
              <FiChevronLeft size={20} />
            </BackButton>
          )}
          <HeaderText>
            <Eyebrow>Settings center</Eyebrow>
            <HeaderTitle>
              {isMobile && activeTab !== 'menu'
                ? settingsTabs.find(t => t.key === activeTab)?.label
                : 'Platform Workspace'}
            </HeaderTitle>
          </HeaderText>
        </HeaderLeft>

        {!isMobile && (
          <TabList
            ref={tabListRef}
            aria-label="Settings sections"
            role="tablist"
          >
            {settingsTabs.map((tab, index) => (
              <Tab
                key={tab.key}
                type="button"
                id={`settings-tab-${tab.key}`}
                $active={activeTab === tab.key}
                role="tab"
                aria-selected={activeTab === tab.key}
                aria-controls={`settings-panel-${tab.key}`}
                tabIndex={activeTab === tab.key ? 0 : -1}
                disabled={isBackendActionLocked}
                onClick={() => selectTab(tab.key)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                <TabIconMobile><tab.Icon /></TabIconMobile>
                <TabLabelDesktop>{tab.label}</TabLabelDesktop>
                {activeTab === tab.key && (
                  <TabActiveBar
                    layoutId="settings-tab-indicator"
                    initial={false}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
              </Tab>
            ))}
          </TabList>
        )}
      </Header>

      <AnimatePresence mode="wait" initial={false}>
        {isMobile && activeTab === 'menu' ? (
          <MobileMenu
            key="menu"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={revealTransition}
          >
            {settingsTabs.map((tab) => (
              <MenuCard
                key={tab.key}
                onClick={() => selectTab(tab.key)}
              >
                <MenuCardLeft>
                  <IconCircle>
                    <tab.Icon />
                  </IconCircle>
                  <MenuCardLabel>{tab.label}</MenuCardLabel>
                </MenuCardLeft>
                <FiChevronRight style={{ opacity: 0.4 }} />
              </MenuCard>
            ))}

            <MenuCard
              $danger
              onClick={handleLogout}
              disabled={isLoggingOut}
              style={{ marginTop: '1rem' }}
            >
              <MenuCardLeft>
                <IconCircle $danger>
                  <FiLogOut />
                </IconCircle>
                <MenuCardLabel $danger>
                  {isLoggingOut ? 'Logging out...' : 'Sign out'}
                </MenuCardLabel>
              </MenuCardLeft>
              <FiChevronRight style={{ opacity: 0.4, color: '#db4a5b' }} />
            </MenuCard>

            <FooterInfo>
              <FooterSticker src="/newstickers/sticker4.png" alt="" />
              <FooterVersion>TripGenius v1.2.4</FooterVersion>
            </FooterInfo>
          </MobileMenu>
        ) : null}

        {activeTab === 'account' ? (
          <ContentPanel
            key="account"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={revealTransition}
          >
            <Card>
              <CardContent>
                <IconCircle>
                  <FiMail />
                </IconCircle>
                <CardBody>
                  <CardTitle>Account Identity</CardTitle>
                  <CardDesc>Update your primary email address for invites and trip synchronization.</CardDesc>

                  <Form onSubmit={updateEmail}>
                    <FieldLabel htmlFor="settings-email">
                      Your Contact Email
                    </FieldLabel>
                    <Input
                      id="settings-email"
                      type="email"
                      value={email}
                      disabled={isUpdatingEmail || isDeletingAccount}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                    <PrimaryBtn
                      type="submit"
                      disabled={isUpdatingEmail || isDeletingAccount}
                      aria-busy={isUpdatingEmail}
                    >
                      {isUpdatingEmail ? 'Syncing...' : 'Update Email'}
                    </PrimaryBtn>
                  </Form>
                </CardBody>
              </CardContent>
            </Card>

            {!isMobile && (
              <CornerSticker>
                <CornerStickerImg src="/newstickers/sticker4.png" alt="" />
              </CornerSticker>
            )}
          </ContentPanel>
        ) : null}

        {activeTab === 'security' ? (
          <ContentPanel
            key="security"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={revealTransition}
          >
            <Card>
              <CardContent>
                <IconCircle>
                  <FiShield />
                </IconCircle>
                <CardBody>
                  <CardTitle>Shield Settings</CardTitle>
                  <CardDesc>Protect your trips with a strong, updated password.</CardDesc>

                  <Form onSubmit={updatePassword}>
                    <SectionInner>
                      <FieldLabel htmlFor="settings-current-password">
                        Current Shield Key
                      </FieldLabel>
                      <Input
                        id="settings-current-password"
                        type="password"
                        value={currentPassword}
                        disabled={isUpdatingPassword || isDeletingAccount}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        required
                      />

                      <FieldLabel htmlFor="settings-next-password" style={{ marginTop: '1rem' }}>
                        New Shield Key
                      </FieldLabel>
                      <Input
                        id="settings-next-password"
                        type="password"
                        value={nextPassword}
                        disabled={isUpdatingPassword || isDeletingAccount}
                        onChange={(event) => setNextPassword(event.target.value)}
                        required
                      />
                    </SectionInner>

                    <PrimaryBtn
                      type="submit"
                      disabled={isUpdatingPassword || isDeletingAccount}
                      aria-busy={isUpdatingPassword}
                    >
                      {isUpdatingPassword ? 'Rotating keys...' : 'Rotate Password'}
                    </PrimaryBtn>
                  </Form>
                </CardBody>
              </CardContent>
            </Card>
          </ContentPanel>
        ) : null}

        {activeTab === 'support' ? (
          <ContentPanel
            key="support"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={revealTransition}
          >
            <Card>
              <CardContent>
                <IconCircle>
                  <FiMessageSquare />
                </IconCircle>
                <CardBody>
                  <CardTitle>Platform Health</CardTitle>
                  <CardDesc>Found a glitch in the map? Report it to our Support Team.</CardDesc>

                  <Form onSubmit={reportBugSend}>
                    <FieldLabel htmlFor="settings-bug-report">
                      Detailed Anomaly Report
                    </FieldLabel>
                    <TextArea
                      id="settings-bug-report"
                      rows={6}
                      value={bugReport}
                      onChange={(event) => setBugReport(event.target.value)}
                      placeholder="Describe the issue, steps to reproduce, and expected outcome..."
                      required
                    />
                    <PrimaryBtn type="submit" disabled={isReportingBug}>
                      {isReportingBug ? 'Transmitting...' : 'Send Signal'}
                    </PrimaryBtn>
                  </Form>
                </CardBody>
              </CardContent>
            </Card>
          </ContentPanel>
        ) : null}

        {activeTab === 'danger' ? (
          <ContentPanel
            key="danger"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={revealTransition}
          >
            <Card $danger>
              <CardContent>
                <IconCircle $danger>
                  <FiAlertTriangle />
                </IconCircle>
                <CardBody>
                  <CardTitle $danger>Burn Sequence</CardTitle>
                  <CardDesc>Permanently erase your account and all travel history. This cannot be reversed.</CardDesc>

                  <div style={{ marginTop: '2rem' }}>
                    <DangerBtn
                      type="button"
                      onClick={deleteAccount}
                      disabled={isBackendActionLocked}
                      aria-busy={isDeletingAccount}
                      style={{ width: isMobile ? '100%' : 'auto' }}
                    >
                      {isDeletingAccount ? 'Burning...' : 'Erase Account Forever'}
                    </DangerBtn>
                  </div>
                </CardBody>
              </CardContent>
            </Card>

            <DangerSticker>
              <DangerStickerImg src="/newstickers/sticker6.png" alt="" />
            </DangerSticker>
          </ContentPanel>
        ) : null}
      </AnimatePresence>
    </Page>
  )
}
