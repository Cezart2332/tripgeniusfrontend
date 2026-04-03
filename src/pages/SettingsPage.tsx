import { useState } from 'react'
import type { FormEvent } from 'react'
import { mockUserProfile } from '../data/mockData'

export function SettingsPage() {
  const [email, setEmail] = useState(mockUserProfile.email)
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [bugReport, setBugReport] = useState('')
  const [feedback, setFeedback] = useState('')

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
      <header className="panel">
        <p className="eyebrow">Settings</p>
        <h1>Account and safety controls</h1>
        <p>Update account credentials, report issues, and manage account risk actions.</p>
        {feedback ? <p className="info-banner">{feedback}</p> : null}
      </header>

      <div className="settings-grid">
        <form className="panel" onSubmit={updateEmail}>
          <h2>Change email</h2>
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
        </form>

        <form className="panel" onSubmit={updatePassword}>
          <h2>Change password</h2>
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
        </form>

        <form className="panel" onSubmit={reportBug}>
          <h2>Report a bug</h2>
          <label className="field-label" htmlFor="settings-bug-report">
            What happened?
          </label>
          <textarea
            id="settings-bug-report"
            className="input input-area"
            rows={5}
            value={bugReport}
            onChange={(event) => setBugReport(event.target.value)}
            placeholder="Describe the issue, expected behavior, and steps to reproduce."
            required
          />
          <button className="btn btn-primary" type="submit">
            Send report
          </button>
        </form>

        <section className="panel danger-panel">
          <h2>Danger zone</h2>
          <p>
            Deleting your account removes profile data, trips, and chat history.
            This action cannot be undone.
          </p>
          <button className="btn btn-danger" type="button">
            Delete account (mock)
          </button>
        </section>
      </div>
    </section>
  )
}
