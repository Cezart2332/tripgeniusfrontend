import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import api from '../data/api'
import { setCredentials, setToken } from '../data/authSlice'

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.2 0-5.8-2.6-5.8-6s2.6-6 5.8-6c1.8 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 6.9 2.4 2.8 6.5 2.8 11.6S6.9 20.8 12 20.8c6.9 0 9.1-4.8 9.1-7.3 0-.5-.1-.9-.1-1.3H12z"
    />
  </svg>
)

const loginHighlights = [
  'Open your trip workspace instantly after sign-in.',
  'Continue where your group left off in map, chat, and timeline.',
  'Keep your profile-driven discovery recommendations active.',
]

const getRequestErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (typeof error === 'object' && error !== null) {
    const errorResponse = (error as { response?: { data?: { message?: unknown } } }).response
    const apiMessage = errorResponse?.data?.message

    if (typeof apiMessage === 'string' && apiMessage.trim().length > 0) {
      return apiMessage
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallbackMessage
}

export function LoginPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

const login = async (email:string, password:string) => {
    const res = await api.post('api/auth/login', { email, password });
    console.log(res)

    dispatch(setToken({ token: res.data.token }));
    
    const user = await api.get('/api/user/me', {
        headers: { Authorization: `Bearer ${res.data.token}` } 
    });
    dispatch(setCredentials({ user: user.data, token: res.data.token }));
}

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setIsLoading(true)

    try {
      await login(email, password)
      navigate('/profile', { replace: true })
    } catch (error) {
      setErrorMessage(
        getRequestErrorMessage(
          error,
          'Could not log in. Please verify your credentials and try again.',
        ),
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="page auth-page">
      <header className="panel auth-headline">
        <p className="eyebrow">Expedition access</p>
        <h1>Return to your travel control room.</h1>
        <p>
          Log in to keep your routes, chat rooms, and member planning in sync.
        </p>
      </header>

      <nav className="auth-switch" aria-label="Authentication pages">
        <Link className="auth-switch-link is-active" to="/login">
          Login
        </Link>
        <Link className="auth-switch-link" to="/register">
          Register
        </Link>
      </nav>

      <div className="auth-flow">
        <form className="panel auth-form-rail" onSubmit={handleSubmit}>
          <h2>Sign in with email</h2>

          <button type="button" className="btn google-btn" disabled={isLoading}>
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="divider">
            <span>or continue with email</span>
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
            disabled={isLoading}
            required
          />

          <label className="field-label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            className="input"
            type="password"
            placeholder="********"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isLoading}
            required
          />

          <button
            className="btn btn-primary"
            type="submit"
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <span className="btn-loading-content">
                <span className="inline-spinner" aria-hidden="true" />
                Logging in...
              </span>
            ) : (
              'Enter workspace'
            )}
          </button>

          {errorMessage ? <p className="info-banner is-error">{errorMessage}</p> : null}
        </form>

        <aside className="panel auth-side-rail">
          <h2>Why log back in?</h2>
          <ul className="auth-point-list">
            {loginHighlights.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <p className="lead">New to TripGenius?</p>
          <Link to="/register" className="btn btn-ghost">
            Create your account
          </Link>
        </aside>
      </div>
    </section>
  )
}
