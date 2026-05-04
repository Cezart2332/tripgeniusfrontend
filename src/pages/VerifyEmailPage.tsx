import { useEffect, useState } from 'react'
import { Link, useSearchParams,useNavigate } from 'react-router-dom'
import { FeedbackToast } from '../components/FeedbackToast'
import type { FeedbackToastState } from '../components/FeedbackToast'
import { FiCheckCircle, FiLoader, FiMail } from 'react-icons/fi'
import { useDispatch } from 'react-redux'
import { setCredentials, setToken } from '../data/authSlice'
import api from '../data/api'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const dispatch = useDispatch()
  const navigate = useNavigate()
  
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>(token ? 'verifying' : 'idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [toast, setToast] = useState<FeedbackToastState | null>(null)

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        return
      }

      try {
        const res = await api.post(`api/auth/verify-email`, { token: token })
        if (res.status === 200) {
          dispatch(setToken({ token: res.data.token }))

          const user = await api.get('/api/user/me', {
            headers: { Authorization: `Bearer ${res.data.token}` },
          })
          dispatch(setCredentials({ user: user.data, token: res.data.token }))

          setTimeout(() => {
            setStatus('success')
            setToast({
              id: Date.now(),
              message: 'Email verified successfully!',
              tone: 'success',
            })
            navigate('/app/profile', { replace: true })
          }, 1500)
        }
      } catch (error) {
        console.error('Email verification failed:', error)
        setStatus('error')
        setErrorMessage('Verification failed. The link may be expired or invalid.')
        setToast({
          id: Date.now(),
          message: 'Verification failed.',
          tone: 'error',
        })
      }
    }

    verifyEmail()
  }, [token, dispatch, navigate])



  return (
    <section className="page auth-page-v2">
      <FeedbackToast toast={toast} clearToast={() => setToast(null)} />

      <div className="auth-split">
        <div className="auth-form-side">
          <header className="auth-form-header">
            <h1>{token ? 'Verifying your account' : 'Verify your email'}</h1>
            <p className="lead">
              {token 
                ? 'Please wait while we confirm your credentials with our secure servers.' 
                : 'We need to verify your email address before you can access all features.'}
            </p>
          </header>

          <div className="auth-form-fields">
            {token ? (
              <div
                className="verification-status-panel"
                style={{
                  padding: '2rem',
                  borderRadius: '18px',
                  background: 'rgba(154, 198, 148, 0.05)',
                  border: '1px solid rgba(154, 198, 148, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1rem',
                  textAlign: 'center',
                }}
              >
                {status === 'verifying' && (
                  <>
                    <FiLoader
                      className="inline-spinner"
                      style={{ fontSize: '2.5rem', color: 'var(--green-580)' }}
                    />
                    <p>Loading your travel data...</p>
                  </>
                )}
                {status === 'success' && (
                  <>
                    <FiCheckCircle style={{ fontSize: '3rem', color: 'var(--green-580)' }} />
                    <h3 style={{ margin: 0, color: '#f3fff1' }}>Verification Complete!</h3>
                    <p>Your account is now fully active. Ready for your next adventure?</p>
                    <Link to="/login" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                      Go to Login
                    </Link>
                  </>
                )}
                {status === 'error' && (
                  <>
                    <FiMail style={{ fontSize: '3rem', color: '#ff6b6b' }} />
                    <h3 style={{ margin: 0, color: '#ff6b6b' }}>Verification Failed</h3>
                    <p>{errorMessage}</p>
                    <Link to="/login" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                      Back to Login
                    </Link>
                  </>
                )}
              </div>
            ) : (
              <div
                style={{
                  padding: '2rem',
                  borderRadius: '18px',
                  background: 'rgba(154, 198, 148, 0.05)',
                  border: '1px solid rgba(154, 198, 148, 0.15)',
                  textAlign: 'center',
                }}
              >
                <FiMail style={{ fontSize: '3rem', color: 'var(--green-580)', marginBottom: '1rem' }} />
                <p>No verification link provided.</p>
                <Link to="/login" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                  Go to Login
                </Link>
              </div>
            )}
            <p className="auth-footer-note" style={{ marginTop: '1rem' }}>
              <Link to="/login" className="text-link">Back to login</Link>
            </p>
          </div>
        </div>

        <aside className="auth-illustration-side" aria-hidden="true">
          <img
            src="/newstickers/sticker4.png"
            alt=""
            className="auth-sticker"
          />
        </aside>
      </div>
    </section>
  )
}
