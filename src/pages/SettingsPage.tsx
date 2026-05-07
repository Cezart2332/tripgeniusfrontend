import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
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
import { FeedbackToast } from '../components/FeedbackToast'
import type { FeedbackToastState, FeedbackToastTone } from '../components/FeedbackToast'
import waitForBackendButtonUnlock from '../utils/interactionDelay'

import { AxiosError } from 'axios'

interface AuthStoreState {
  auth: {
    user: User | null
    token: string | null
  }
}

type SettingsTab = 'account' | 'security' | 'support' | 'danger'

const settingsTabs: Array<{ key: SettingsTab; label: string; Icon: any }> = [
  { key: 'account', label: 'Account', Icon: FiUser },
  { key: 'security', label: 'Security', Icon: FiShield },
  { key: 'support', label: 'Support', Icon: FiHelpCircle },
  { key: 'danger', label: 'Danger zone', Icon: FiTrash2 },
]

const revealTransition = {
  duration: 0.58,
  ease: [0.22, 1, 0.36, 1] as const,
}

export function SettingsPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const [searchParams, setSearchParams] = useSearchParams()
  const tabListRef = useRef<HTMLElement | null>(null)
  const requestedTab = searchParams.get('tab')
  
  // On mobile, if no tab is explicitly requested, we show the menu list
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 850)
  
  const activeTab: SettingsTab | 'menu' =
    requestedTab && settingsTabs.some((tab) => tab.key === requestedTab)
      ? (requestedTab as SettingsTab)
      : (isMobile ? 'menu' : 'account')

  const [email, setEmail] = useState(user?.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [bugReport, setBugReport] = useState('')
  const [toast, setToast] = useState<FeedbackToastState | null>(null)
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

  const showToast = (message: string, tone: FeedbackToastTone) => {
    setToast({
      id: Date.now(),
      message,
      tone,
    })
  }

  useEffect(() => {
    if (!shouldRedirectToLogin) {
      return
    }

    setToast({
      id: Date.now(),
      message: 'You will be redirected in 2 seconds to login page',
      tone: 'info',
    })

    const timeoutId = window.setTimeout(() => {
      navigate('/login', { replace: true })
    }, 2000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [shouldRedirectToLogin, navigate])

  if(!user)
  {
    return (
      <section className="page settings-page-v2 container">
        <FeedbackToast toast={toast} clearToast={() => setToast(null)} />
        <div className="discovery-empty-state">
          <img src="/newstickers/sticker5.png" alt="" className="discovery-empty-sticker" />
          <h1>You are not logged in</h1>
          <p>Log in to manage your account details and security settings.</p>
          <Link className="btn btn-primary" to="/login">
            Go to login
          </Link>
        </div>
      </section>
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
      const res = await api.patch('api/user/change-mail', {newEmail})
      console.log(res)
      const newUser = await api.get('api/user/me')
      dispatch(setUser({user: newUser.data}))
  }

  const updateEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isUpdatingEmail || isDeletingAccount || isReportingBug) {
      return
    }

    setIsUpdatingEmail(true)

    try{
      await changeEmail(email)
      showToast('Email updated successfully.', 'success')
    }
    catch(err : any)
    {
      if (err?.queued) {
        showToast('Email update will be synchronized when online.', 'success')
      }
      else if(err instanceof AxiosError)
      {
        console.log(err.response)
        const message = err.response?.data?.message || err.response?.data || "Email change failed"
        showToast(String(message), 'error')
      }
      else
      {
        showToast('Email change failed.', 'error')
      }
    }
    finally
    {
      await waitForBackendButtonUnlock()
      setIsUpdatingEmail(false)
    }
  }

  const changePassword = async (oldPassword : string, newPassword : string) => {
    await api.patch("api/user/change-password", {oldPassword, newPassword})
  }

  const updatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isUpdatingPassword || isDeletingAccount || isReportingBug) {
      return
    }

    setIsUpdatingPassword(true)

    try
    {
      await changePassword(currentPassword,nextPassword)
      showToast('Password changed successfully.', 'success')
      setCurrentPassword('')
      setNextPassword('')
    }
    catch(err : any)
    {
      if (err?.queued) {
        showToast('Password change will be synchronized when online.', 'success')
        setCurrentPassword('')
        setNextPassword('')
      }
      else if(err instanceof AxiosError)
      {
        const message = err.response?.data?.message || err.response?.data || "Password change failed"
        showToast(String(message), 'error')
      }
    }
    finally
    {
      await waitForBackendButtonUnlock()
      setIsUpdatingPassword(false)
    }
  }

  const reportBug = async(description : string) =>{
     await api.post('api/bug/bug-report', {description: description})
  }

  const reportBugSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if(isDeletingAccount || isUpdatingEmail || isUpdatingPassword)
    {
      return
    }
    setIsReportingBug(true)
    try
    {
      await reportBug(bugReport)
      showToast('Bug report received. Thank you for helping improve TripGenius.', 'info')
      setBugReport('')
    }
    catch(err : any)
    {
      if (err?.queued) {
        showToast('Bug report will be sent when online.', 'success')
        setBugReport('')
      }
      else if(err instanceof AxiosError)
      {
        const message = err.response?.data?.message || err.response?.data || "Bug report failed"
        showToast(String(message), 'error')
      }
    }
    finally
    {
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

    try
    {
      await api.delete("api/user/delete-account")
      showToast('Account deleted. Redirecting to login...', 'success')
      shouldNavigate = true
    }
    catch(err : any)
    {
      if (err?.queued) {
        showToast('Account deletion will be processed when online.', 'success')
      }
      else if(err instanceof AxiosError)
      {
        console.log(err.response)
        const message = err.response?.data?.message || err.response?.data || "Account deletion failed"
        showToast(String(message), 'error')
      }
      else
      {
        showToast('Account deletion failed.', 'error')
      }
    }
    finally
    {
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
    <section className="page settings-page-v2 container">
      <FeedbackToast toast={toast} clearToast={() => setToast(null)} />
      
      <header className="profile-header-v2">
        <div className="profile-tab-header-v2">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {isMobile && activeTab !== 'menu' && (
              <button 
                className="icon-link" 
                onClick={() => selectTab('menu')}
                aria-label="Back to settings menu"
                style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.05)' }}
              >
                <FiChevronLeft size={20} />
              </button>
            )}
            <div>
              <p className="eyebrow">Settings center</p>
              <h1>
                {isMobile && activeTab !== 'menu' 
                  ? settingsTabs.find(t => t.key === activeTab)?.label 
                  : 'Platform Workspace'}
              </h1>
            </div>
          </div>
        </div>

        {!isMobile && (
          <nav
            ref={tabListRef}
            className="profile-tab-bar-v2"
            aria-label="Settings sections"
            role="tablist"
          >
            {settingsTabs.map((tab, index) => (
              <button
                key={tab.key}
                type="button"
                id={`settings-tab-${tab.key}`}
                className={activeTab === tab.key ? 'profile-tab-btn-v2 is-active' : 'profile-tab-btn-v2'}
                role="tab"
                aria-selected={activeTab === tab.key}
                aria-controls={`settings-panel-${tab.key}`}
                tabIndex={activeTab === tab.key ? 0 : -1}
                disabled={isBackendActionLocked}
                onClick={() => selectTab(tab.key)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                <span className="tab-icon-mobile"><tab.Icon /></span>
                <span className="tab-label-desktop">{tab.label}</span>
              </button>
            ))}
          </nav>
        )}
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {isMobile && activeTab === 'menu' ? (
          <motion.div
            key="menu"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={revealTransition}
            className="settings-mobile-menu"
            style={{ display: 'grid', gap: '0.75rem' }}
          >
            {settingsTabs.map((tab) => (
              <button
                key={tab.key}
                className="settings-card-v2"
                onClick={() => selectTab(tab.key)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '1.25rem 1.5rem',
                  textAlign: 'left',
                  width: '100%',
                  background: 'rgba(9, 14, 10, 0.4)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className="notification-icon-v2" style={{ width: '36px', height: '36px', fontSize: '1rem' }}>
                    <tab.Icon />
                  </div>
                  <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>{tab.label}</span>
                </div>
                <FiChevronRight style={{ opacity: 0.4 }} />
              </button>
            ))}

            <button
              className="settings-card-v2"
              onClick={handleLogout}
              disabled={isLoggingOut}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '1.25rem 1.5rem',
                textAlign: 'left',
                width: '100%',
                background: 'rgba(255, 107, 107, 0.1)',
                cursor: 'pointer',
                marginTop: '1rem',
                borderColor: 'rgba(255, 107, 107, 0.2)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className="notification-icon-v2" style={{ width: '36px', height: '36px', fontSize: '1rem', background: 'rgba(255, 107, 107, 0.2)', color: '#ff6b6b' }}>
                  <FiLogOut />
                </div>
                <span style={{ fontWeight: 600, fontSize: '1.05rem', color: '#ff6b6b' }}>
                  {isLoggingOut ? 'Logging out...' : 'Sign out'}
                </span>
              </div>
              <FiChevronRight style={{ opacity: 0.4, color: '#ff6b6b' }} />
            </button>
            
            <div style={{ textAlign: 'center', marginTop: '2rem', opacity: 0.4 }}>
              <img src="/newstickers/sticker4.png" alt="" style={{ width: '100px' }} />
              <p style={{ fontSize: '0.8rem', marginTop: '1rem' }}>TripGenius v1.2.4</p>
            </div>
          </motion.div>
        ) : null}

        {activeTab === 'account' ? (
          <motion.div
            key="account"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={revealTransition}
            className="settings-grid-v2"
          >
            <div className="settings-card-v2">
              <div className="settings-card-content-v2">
                <div className="notification-icon-v2">
                  <FiMail />
                </div>
                <div style={{ flex: 1 }}>
                  <h3>Account Identity</h3>
                  <p>Update your primary email address for invites and trip synchronization.</p>
                  
                  <form onSubmit={updateEmail} className="profile-form-v2">
                    <label className="field-label" htmlFor="settings-email">
                      Your Contact Email
                    </label>
                    <input
                      id="settings-email"
                      className="input"
                      type="email"
                      value={email}
                      disabled={isUpdatingEmail || isDeletingAccount}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                    <button
                      className="btn btn-primary"
                      type="submit"
                      disabled={isUpdatingEmail || isDeletingAccount}
                      aria-busy={isUpdatingEmail}
                    >
                      {isUpdatingEmail ? 'Syncing...' : 'Update Email'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
            
            {!isMobile && (
              <div style={{ textAlign: 'center', opacity: 0.6 }}>
                <img src="/newstickers/sticker4.png" alt="" style={{ width: '120px' }} />
              </div>
            )}
          </motion.div>
        ) : null}

        {activeTab === 'security' ? (
          <motion.div
            key="security"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={revealTransition}
            className="settings-grid-v2"
          >
            <div className="settings-card-v2">
              <div className="settings-card-content-v2">
                <div className="notification-icon-v2">
                  <FiShield />
                </div>
                <div style={{ flex: 1 }}>
                  <h3>Shield Settings</h3>
                  <p>Protect your trips with a strong, updated password.</p>
                  
                  <form onSubmit={updatePassword} className="profile-form-v2">
                    <div className="profile-section-v2" style={{ background: 'transparent', padding: 0, border: 'none' }}>
                      <label className="field-label" htmlFor="settings-current-password">
                        Current Shield Key
                      </label>
                      <input
                        id="settings-current-password"
                        className="input"
                        type="password"
                        value={currentPassword}
                        disabled={isUpdatingPassword || isDeletingAccount}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        required
                      />

                      <label className="field-label" htmlFor="settings-next-password" style={{ marginTop: '1rem' }}>
                        New Shield Key
                      </label>
                      <input
                        id="settings-next-password"
                        className="input"
                        type="password"
                        value={nextPassword}
                        disabled={isUpdatingPassword || isDeletingAccount}
                        onChange={(event) => setNextPassword(event.target.value)}
                        required
                      />
                    </div>
                    
                    <button
                      className="btn btn-primary"
                      type="submit"
                      disabled={isUpdatingPassword || isDeletingAccount}
                      aria-busy={isUpdatingPassword}
                    >
                      {isUpdatingPassword ? 'Rotating keys...' : 'Rotate Password'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}

        {activeTab === 'support' ? (
          <motion.div
            key="support"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={revealTransition}
            className="settings-grid-v2"
          >
            <div className="settings-card-v2">
              <div className="settings-card-content-v2">
                <div className="notification-icon-v2">
                  <FiMessageSquare />
                </div>
                <div style={{ flex: 1 }}>
                  <h3>Platform Health</h3>
                  <p>Found a glitch in the map? Report it to our Support Team.</p>
                  
                  <form onSubmit={reportBugSend} className="profile-form-v2">
                    <label className="field-label" htmlFor="settings-bug-report">
                      Detailed Anomaly Report
                    </label>
                    <textarea
                      id="settings-bug-report"
                      className="input input-area"
                      rows={6}
                      value={bugReport}
                      onChange={(event) => setBugReport(event.target.value)}
                      placeholder="Describe the issue, steps to reproduce, and expected outcome..."
                      required
                    />
                    <button className="btn btn-primary" type="submit" disabled={isReportingBug}>
                      {isReportingBug ? 'Transmitting...' : 'Send Signal'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}

        {activeTab === 'danger' ? (
          <motion.div
            key="danger"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={revealTransition}
            className="settings-grid-v2"
          >
            <div className="settings-card-v2" style={{ borderColor: 'rgba(255, 100, 100, 0.2)' }}>
              <div className="settings-card-content-v2">
                <div className="notification-icon-v2" style={{ background: 'rgba(255, 100, 100, 0.1)', color: '#ff6b6b' }}>
                  <FiAlertTriangle />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ color: '#ff6b6b' }}>Burn Sequence</h3>
                  <p>Permanently erase your account and all travel history. This cannot be reversed.</p>
                  
                  <div style={{ marginTop: '2rem' }}>
                    <button
                      className="btn btn-danger btn-lg"
                      type="button"
                      onClick={deleteAccount}
                      disabled={isBackendActionLocked}
                      aria-busy={isDeletingAccount}
                      style={{ width: isMobile ? '100%' : 'auto' }}
                    >
                      {isDeletingAccount ? 'Burning...' : 'Erase Account Forever'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div style={{ textAlign: 'center', opacity: 0.4 }}>
               <img src="/newstickers/sticker6.png" alt="" style={{ width: '150px' }} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}
