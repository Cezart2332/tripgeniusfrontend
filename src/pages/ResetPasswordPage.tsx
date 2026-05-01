import { useState } from 'react'
import { Link, useSearchParams,useNavigate } from 'react-router-dom'
import { FeedbackToast } from '../components/FeedbackToast'
import type { FeedbackToastState } from '../components/FeedbackToast'
import { useDispatch } from 'react-redux'
import { setCredentials, setToken } from '../data/authSlice'
import { FiLock, FiMail } from 'react-icons/fi'
import { AxiosError } from 'axios'
import api from '../data/api'
import waitForBackendButtonUnlock from '../utils/interactionDelay'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const isResetWithToken = Boolean(token)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState<FeedbackToastState | null>(null)

  const showToast = (message: string, tone: 'success' | 'error' | 'info') => {
    setToast({
      id: Date.now(),
      message,
      tone,
    })
  }

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      showToast('Passwords do not match.', 'error')
      return
    }

    setIsLoading(true)

    try {
      const res = await api.patch('/api/auth/reset-password', {
        token,
        password,
      })
      if (res.status === 200) {
        dispatch(setToken({ token: res.data.token }))

          const user = await api.get('/api/user/me', {
            headers: { Authorization: `Bearer ${res.data.token}` },
          })
          dispatch(setCredentials({ user: user.data, token: res.data.token }))

          setTimeout(() => {
            setToast({
              id: Date.now(),
              message: 'Password reset successfully!',
              tone: 'success',
            })
            navigate('/profile', { replace: true })
          }, 1500)
        }
      showToast('Password reset successful!', 'success')
      setPassword('')
      setConfirmPassword('')
    }
    catch (error: unknown) {
      if (error instanceof AxiosError) {
        const message = error.response?.data?.message || error.response?.data || 'Could not reset password. Please try again.'
        showToast(String(message), 'error')
      } else {
        showToast('Could not reset password. Please try again.', 'error')
      }
    }
    finally {
      await waitForBackendButtonUnlock()
      setIsLoading(false)
    }
  }

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setIsLoading(true)

    try {
      await api.post('/api/auth/forgot-password', { email })
      showToast('If this email exists, a reset link has been sent.', 'success')
    }
    catch (error: unknown) {
      if (error instanceof AxiosError) {
        const message = error.response?.data?.message || error.response?.data || 'Could not send reset email. Please try again.'
        showToast(String(message), 'error')
      } else {
        showToast('Could not send reset email. Please try again.', 'error')
      }
    }
    finally {
      await waitForBackendButtonUnlock()
      setIsLoading(false)
    }
  }

  return (
    <section className="page auth-page-v2">
      <FeedbackToast toast={toast} clearToast={() => setToast(null)} />

      <div className="auth-split">
        <div className="auth-form-side">
          <header className="auth-form-header">
            <h1>{isResetWithToken ? 'Reset your password' : 'Forgot password?'}</h1>
            <p className="lead">
              {isResetWithToken
                ? 'Create a new secure password for your account.'
                : 'Enter your email and we will send you a password reset link.'}
            </p>
          </header>

          <div className="auth-form-fields">
            {isResetWithToken ? (
              <form onSubmit={handlePasswordResetSubmit} className="auth-form-fields">
                <label className="field-label" htmlFor="new-password">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="new-password"
                    className="input"
                    type="password"
                    placeholder="********"
                    style={{ paddingLeft: '2.8rem' }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                  <FiLock style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-380)' }} />
                </div>

                <label className="field-label" htmlFor="confirm-password">Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="confirm-password"
                    className="input"
                    type="password"
                    placeholder="********"
                    style={{ paddingLeft: '2.8rem' }}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                  <FiLock style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-380)' }} />
                </div>

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? 'Updating password...' : 'Update Password'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="auth-form-fields">
                <label className="field-label" htmlFor="forgot-password-email">Email</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="forgot-password-email"
                    className="input"
                    type="email"
                    placeholder="you@example.com"
                    style={{ paddingLeft: '2.8rem' }}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                  <FiMail style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-380)' }} />
                </div>

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? 'Sending reset link...' : 'Send reset link'}
                </button>
              </form>
            )}

            <p className="auth-footer-note" style={{ marginTop: '1.5rem' }}>
              <Link to="/login" className="text-link">Back to login</Link>
            </p>
          </div>
        </div>

        <aside className="auth-illustration-side" aria-hidden="true">
          <img
            src="/newstickers/sticker5.png"
            alt=""
            className="auth-sticker"
          />
        </aside>
      </div>
    </section>
  )
}
