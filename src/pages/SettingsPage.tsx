import { AnimatePresence, motion } from 'framer-motion'
import { useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { mockUserProfile } from '../data/mockData'

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
  const [searchParams, setSearchParams] = useSearchParams()
  const tabListRef = useRef<HTMLElement | null>(null)
  const requestedTab = searchParams.get('tab')
  const activeTab: SettingsTab =
    requestedTab && settingsTabs.some((tab) => tab.key === requestedTab)
      ? (requestedTab as SettingsTab)
      : 'account'
  const [email, setEmail] = useState(mockUserProfile.email)
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [bugReport, setBugReport] = useState('')
  const [feedback, setFeedback] = useState('')

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

  const updateEmail = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFeedback('Email updated in mock mode.')
  }

  const updatePassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFeedback('Password change submitted in mock mode.')
    setCurrentPassword('')
    setNextPassword('')
  }

  const reportBug = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFeedback('Bug report received. Thank you for helping improve TripGenius.')
    setBugReport('')
  }

  return (
    <section className="page settings-page">
      <header className="panel settings-head">
        <p className="eyebrow">Settings center</p>
        <h1>Manage account, security, and platform health.</h1>
        <p>Switch sections below to focus one task at a time.</p>
        {feedback ? <p className="info-banner">{feedback}</p> : null}
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
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <button className="btn btn-primary" type="submit">
              Save email
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
              onChange={(event) => setNextPassword(event.target.value)}
              required
            />

            <button className="btn btn-primary" type="submit">
              Save password
            </button>
          </motion.form>
        ) : null}

        {activeTab === 'support' ? (
          <motion.form
            key="support"
            className="panel settings-section"
            onSubmit={reportBug}
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
            <button className="btn btn-danger" type="button">
              Delete account (mock)
            </button>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </section>
  )
}
