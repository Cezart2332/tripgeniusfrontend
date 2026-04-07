import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link, useSearchParams,useNavigate } from 'react-router-dom'
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

const settingsTabs: Array<{ key: SettingsTab; label: string }> = [
  { key: 'account', label: 'Account' },
  { key: 'security', label: 'Security' },
  { key: 'support', label: 'Support' },
  { key: 'danger', label: 'Danger zone' },
]

const sectionTransition = {
  duration: 0.24,
  ease: [0.22, 1, 0.36, 1] as const,
}

export function SettingsPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const token = useSelector((state: AuthStoreState) => state.auth.token)
  const [searchParams, setSearchParams] = useSearchParams()
  const tabListRef = useRef<HTMLElement | null>(null)
  const requestedTab = searchParams.get('tab')
  const activeTab: SettingsTab =
    requestedTab && settingsTabs.some((tab) => tab.key === requestedTab)
      ? (requestedTab as SettingsTab)
      : 'account'
  const [email, setEmail] = useState(user?.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [bugReport, setBugReport] = useState('')
  const [toast, setToast] = useState<FeedbackToastState | null>(null)
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [isReportingBug, setIsReportingBug] = useState(false)
  const isBackendActionLocked = isUpdatingEmail || isUpdatingPassword || isDeletingAccount || isReportingBug
  const shouldRedirectToLogin = !token

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

  if(!user || !token)
  {
    return (
      <section className="page settings-page">
        <FeedbackToast toast={toast} clearToast={() => setToast(null)} />
        <section className="panel settings-section settings-empty-state">
          <p className="eyebrow">Settings center</p>
          <h1>You are not logged in</h1>
          <p>Log in to update account details, security settings, and support tickets.</p>
          <Link className="btn btn-primary" to="/login">
            Go to login
          </Link>
        </section>
      </section>
    )
  }

  const selectTab = (nextTab: SettingsTab) => {
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
      const newUser  = await api.get('api/user/me', {headers: {Authorization: `Bearer ${token}`}})
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
    catch(err : unknown)
    {
      if(err instanceof AxiosError)
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
    catch(err : unknown)
    {
      if(err instanceof AxiosError)
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
     api.post('api/user/bug-report', {description})
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
    catch(err : unknown)
    {
      if(err instanceof AxiosError)
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
    catch(err : unknown)
    {
      if(err instanceof AxiosError)
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


  return (
    <section className="page settings-page">
      <FeedbackToast toast={toast} clearToast={() => setToast(null)} />
      <header className="panel settings-head">
        <p className="eyebrow">Settings center</p>
        <h1>Manage account, security, and platform health.</h1>
        <p>Switch sections below to focus one task at a time.</p>
      </header>

      <nav
        ref={tabListRef}
        className="settings-tab-bar"
        aria-label="Settings sections"
        role="tablist"
      >
        {settingsTabs.map((tab, index) => (
          <button
            key={tab.key}
            type="button"
            id={`settings-tab-${tab.key}`}
            className={activeTab === tab.key ? 'settings-tab-btn is-active' : 'settings-tab-btn'}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`settings-panel-${tab.key}`}
            tabIndex={activeTab === tab.key ? 0 : -1}
            disabled={isBackendActionLocked}
            onClick={() => selectTab(tab.key)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait" initial={false}>
        {activeTab === 'account' ? (
          <motion.form
            key="account"
            className="panel settings-section"
            onSubmit={updateEmail}
            id="settings-panel-account"
            role="tabpanel"
            aria-labelledby="settings-tab-account"
            tabIndex={0}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={sectionTransition}
          >
            <h2>Account email</h2>
            <p>Use a reliable inbox for invites, updates, and trip notifications.</p>
            <label className="field-label" htmlFor="settings-email">
              New email
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
              {isUpdatingEmail ? (
                <span className="btn-loading-content">
                  <span className="inline-spinner" aria-hidden="true" />
                  Saving email...
                </span>
              ) : (
                'Save email'
              )}
            </button>
          </motion.form>
        ) : null}

        {activeTab === 'security' ? (
          <motion.form
            key="security"
            className="panel settings-section"
            onSubmit={updatePassword}
            id="settings-panel-security"
            role="tabpanel"
            aria-labelledby="settings-tab-security"
            tabIndex={0}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={sectionTransition}
          >
            <h2>Password security</h2>
            <p>Change your password regularly to keep trip workspaces safe.</p>

            <label className="field-label" htmlFor="settings-current-password">
              Current password
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

            <label className="field-label" htmlFor="settings-next-password">
              New password
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

            <button
              className="btn btn-primary"
              type="submit"
              disabled={isUpdatingPassword || isDeletingAccount}
              aria-busy={isUpdatingPassword}
            >
              {isUpdatingPassword ? (
                <span className="btn-loading-content">
                  <span className="inline-spinner" aria-hidden="true" />
                  Saving password...
                </span>
              ) : (
                'Save password'
              )}
            </button>
          </motion.form>
        ) : null}

        {activeTab === 'support' ? (
          <motion.form
            key="support"
            className="panel settings-section"
            onSubmit={reportBugSend}
            id="settings-panel-support"
            role="tabpanel"
            aria-labelledby="settings-tab-support"
            tabIndex={0}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={sectionTransition}
          >
            <h2>Support and bug reports</h2>
            <p>
              Share reproducible details so the team can triage and fix issues faster.
            </p>
            <label className="field-label" htmlFor="settings-bug-report">
              What happened?
            </label>
            <textarea
              id="settings-bug-report"
              className="input input-area"
              rows={6}
              value={bugReport}
              onChange={(event) => setBugReport(event.target.value)}
              placeholder="Describe issue, expected behavior, and reproduction steps."
              required
            />
            <button className="btn btn-primary" type="submit">
              Send report
            </button>
          </motion.form>
        ) : null}

        {activeTab === 'danger' ? (
          <motion.section
            key="danger"
            className="panel settings-section danger-panel"
            id="settings-panel-danger"
            role="tabpanel"
            aria-labelledby="settings-tab-danger"
            tabIndex={0}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={sectionTransition}
          >
            <h2>Danger zone</h2>
            <p>
              Deleting your account removes profile data, trips, and chat history.
              This action cannot be undone.
            </p>
            <button
              className="btn btn-danger"
              type="button"
              onClick={deleteAccount}
              disabled={isBackendActionLocked}
              aria-busy={isDeletingAccount}
            >
              {isDeletingAccount ? (
                <span className="btn-loading-content">
                  <span className="inline-spinner" aria-hidden="true" />
                  Deleting account...
                </span>
              ) : (
                'Delete account'
              )}
            </button>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </section>
  )
}


