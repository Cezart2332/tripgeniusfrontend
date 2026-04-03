import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.2 0-5.8-2.6-5.8-6s2.6-6 5.8-6c1.8 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 6.9 2.4 2.8 6.5 2.8 11.6S6.9 20.8 12 20.8c6.9 0 9.1-4.8 9.1-7.3 0-.5-.1-.9-.1-1.3H12z"
    />
  </svg>
)

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <section className="page auth-page">
      <div className="auth-grid">
        <aside className="panel promo-panel">
          <p className="eyebrow">Welcome back</p>
          <h1>Continue your next group adventure.</h1>
          <p>
            Sign in to manage trip timelines, organize expenses, and keep your
            crew connected online and offline.
          </p>
          <Link to="/register" className="text-link">
            New to TripGenius? Create an account
          </Link>
        </aside>

        <form className="panel auth-card" onSubmit={handleSubmit}>
          <h2>Log in</h2>

          <button type="button" className="btn google-btn">
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="divider">
            <span>or sign in with email</span>
          </div>

          <label className="field-label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            className="input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label className="field-label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            className="input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <button className="btn btn-primary" type="submit">
            Log in
          </button>

          {submitted ? (
            <p className="info-banner">Mock login successful. Redirect can be wired to backend auth later.</p>
          ) : null}
        </form>
      </div>
    </section>
  )
}
