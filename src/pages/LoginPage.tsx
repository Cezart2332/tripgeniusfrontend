import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { GoogleLogin } from '@react-oauth/google'
import api from '../data/api'
import { setCredentials, setToken } from '../data/authSlice'
import { AxiosError } from 'axios'
import { FeedbackToast } from '../components/FeedbackToast'
import type { FeedbackToastState, FeedbackToastTone } from '../components/FeedbackToast'
import waitForBackendButtonUnlock from '../utils/interactionDelay'
import { subscribeForNotifications } from '../utils/notifications'
import { usePWAInstall } from '../hooks/usePWAInstall'
import { PWAInstallPopup } from '../components/PWAInstallPopup'

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.2 0-5.8-2.6-5.8-6s2.6-6 5.8-6c1.8 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 6.9 2.4 2.8 6.5 2.8 11.6S6.9 20.8 12 20.8c6.9 0 9.1-4.8 9.1-7.3 0-.5-.1-.9-.1-1.3H12z"
    />
  </svg>
)

export function LoginPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const hasGoogleClientId = Boolean((import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState<FeedbackToastState | null>(null)
  const { showInstallPopup, isIos, dismissPopup, handleInstallClick } = usePWAInstall()

  const showToast = (message: string, tone: FeedbackToastTone) => {
    setToast({
      id: Date.now(),
      message,
      tone,
    })
  }

  const login = async (emailValue: string, passwordValue: string) => {
    const res = await api.post('api/auth/login', { email: emailValue, password: passwordValue })

    if (!res.data?.token) {
      throw new Error('Invalid login response')
    }

    dispatch(setToken({ token: res.data.token }))

    const user = await api.get('/api/user/me', {
      headers: { Authorization: `Bearer ${res.data.token}` },
    })
    dispatch(setCredentials({ user: user.data, token: res.data.token }))
  }

  const loginWithGoogleCredential = async (credential: string) => {
    const res = await api.post('/api/auth/google-login', { idToken: credential })

    if (!res.data?.token) {
      throw new Error('Invalid Google login response')
    }

    dispatch(setToken({ token: res.data.token }))

    if (res.data?.user) {
      dispatch(setCredentials({ user: res.data.user, token: res.data.token }))
      return
    }

    const user = await api.get('/api/user/me', {
      headers: { Authorization: `Bearer ${res.data.token}` },
    })
    dispatch(setCredentials({ user: user.data, token: res.data.token }))
  }

  const handleGoogleSuccess = async (credentialResponse: { credential?: string | null }) => {
    if (!credentialResponse.credential) {
      showToast('Google login failed. Please try again.', 'error')
      return
    }

    setIsLoading(true)

    try {
      await loginWithGoogleCredential(credentialResponse.credential)
      await subscribeForNotifications()
      showToast('Login successful. Redirecting...', 'success')
      navigate('/app/profile', { replace: true })
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        const message = err.response?.data?.message || err.response?.data || 'Google login failed. Please try again.'
        showToast(String(message), 'error')
      } else {
        showToast('Google login failed. Please try again.', 'error')
      }
    } finally {
      await waitForBackendButtonUnlock()
      setIsLoading(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isLoading) {
      return
    }

    setIsLoading(true)
    let shouldNavigate = false

    try {
      await login(email, password)
      await subscribeForNotifications()
      showToast('Login successful. Redirecting...', 'success')
      shouldNavigate = true
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response?.status !== 200) {
        const data = err.response?.data
        const errorMessage = String(data?.message)
        showToast(errorMessage, 'error')
      } else {
        showToast('Could not log in. Please try again.', 'error')
      }
    } finally {
      await waitForBackendButtonUnlock()
      setIsLoading(false)
    }

    if (shouldNavigate) {
      navigate('/app/profile', { replace: true })
    }
  }

  return (
    <section className="page auth-page-v2 container">
      <FeedbackToast toast={toast} clearToast={() => setToast(null)} />

      <div className="auth-split">
        <div className="auth-form-side">
          <header className="auth-form-header">
            <h1>Welcome back</h1>
            <p className="lead">Sign in to your expedition workspace.</p>
          </header>

          <nav className="auth-toggle-bar" aria-label="Authentication pages">
            <Link className="auth-toggle-link is-active" to="/login">Login</Link>
            <Link className="auth-toggle-link" to="/register">Register</Link>
          </nav>

          <form onSubmit={handleSubmit} className="auth-form-fields">
            {hasGoogleClientId ? (
              <div style={{ position: 'relative', overflow: 'hidden' }}>
                <button
                  type="button"
                  className="btn google-btn"
                  disabled={isLoading}
                  style={{ width: '100%' }}
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0.001,
                    zIndex: 10,
                  }}
                >
                  <div style={{ transform: 'scale(10)', transformOrigin: 'top left' }}>
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={() => showToast('Google login was canceled or failed.', 'error')}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn google-btn"
                disabled
              >
                <GoogleIcon />
                Continue with Google
              </button>
            )}

            <div className="divider"><span>or continue with email</span></div>

            <label className="field-label" htmlFor="login-email">Email</label>
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

            <label className="field-label" htmlFor="login-password">Password</label>
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.2rem' }}>
              <Link to="/reset-password" style={{ fontSize: '0.8rem', color: 'var(--text-380)', textDecoration: 'none' }}>Forgot password?</Link>
            </div>

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

            <p className="auth-footer-note">
              New to TripGenius?{' '}
              <Link to="/register" className="text-link">Create your account</Link>
            </p>
          </form>
        </div>

        <aside className="auth-illustration-side" aria-hidden="true">
          <img
            src="/newstickers/sticker4.png"
            alt=""
            className="auth-sticker"
          />
        </aside>
      </div>

      <PWAInstallPopup
        show={showInstallPopup}
        isIos={isIos}
        onDismiss={dismissPopup}
        onInstall={handleInstallClick}
      />
    </section>
  )
}
