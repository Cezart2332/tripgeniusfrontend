import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { tripTypeOptions } from '../data/tripTypeOptions'
import api from '../data/api'
import { AxiosError } from 'axios'
import { FeedbackToast } from '../components/FeedbackToast'
import type { FeedbackToastState, FeedbackToastTone } from '../components/FeedbackToast'
import waitForBackendButtonUnlock from '../utils/interactionDelay'

interface RegisterState {
  username: string
  email: string
  password: string
  tags: string[]
  maxGroupSize: number
}

const ACCOUNT_CREATED_TOAST_DELAY_MS = 1800
const VERIFY_EMAIL_TOAST_DELAY_MS = 2200


const toggleTripType = (current: string[], type: string): string[] =>
  current.includes(type)
    ? current.filter((item) => item !== type)
    : [...current, type]

const createInitialState = (): RegisterState => ({
  username: '',
  email: '',
  password: '',
  tags: ['adventure', 'nature'],
  maxGroupSize: 8,
})

export function RegisterPage() {
  const navigate = useNavigate()
  const [formState, setFormState] = useState<RegisterState>(createInitialState)
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState<FeedbackToastState | null>(null)

  const showToast = (message: string, tone: FeedbackToastTone) => {
    setToast({
      id: Date.now(),
      message,
      tone,
    })
  }

  const register = async (
    username: string,
    email: string,
    password: string,
    tags: string[],
    maxGroupSize: number,
  ) => {
    const res = await api.post('api/auth/register', {
      email,
      password,
      username,
      tags,
      maxGroupSize,
    })
    showToast('Account created successfully.', 'success')
    await waitForBackendButtonUnlock(ACCOUNT_CREATED_TOAST_DELAY_MS)
    showToast(String(res?.data ?? 'Please verify your email before logging in.'), 'info')
    await waitForBackendButtonUnlock(VERIFY_EMAIL_TOAST_DELAY_MS)

  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isLoading) {
      return
    }

    setIsLoading(true)
    let registrationSucceeded = false

    try 
    {
      await register(
        formState.username,
        formState.email,
        formState.password,
        formState.tags,
        formState.maxGroupSize,
      )
      registrationSucceeded = true
    } 
    catch (err : unknown) 
    {
      if(err instanceof AxiosError)
      {
        const message = err.response?.data?.message || err.response?.data || "There was an issue, please try again later"
        showToast(String(message), 'error')
      }
      else
      {
        showToast('Could not register your account. Please try again in a moment.', 'error')
      }
    } 
    finally 
    {
      await waitForBackendButtonUnlock()
      setIsLoading(false)
    }

    if (registrationSucceeded) {
      navigate('/', { replace: true })
    }

  }

  return (
    <section className="page auth-page-v2 container">
      <FeedbackToast toast={toast} clearToast={() => setToast(null)} />

      <div className="auth-split">
        <div className="auth-form-side">
          <header className="auth-form-header">
            <h1>Create your account</h1>
            <p className="lead">Set up your profile and travel preferences in one go.</p>
          </header>

          <nav className="auth-toggle-bar" aria-label="Authentication pages">
            <Link className="auth-toggle-link" to="/login">Login</Link>
            <Link className="auth-toggle-link is-active" to="/register">Register</Link>
          </nav>

          <form className="auth-form-fields" onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="register-name">Username</label>
            <input
              id="register-name"
              className="input"
              type="text"
              placeholder="Your name"
              value={formState.username}
              onChange={(event) =>
                setFormState((previous) => ({
                  ...previous,
                  username: event.target.value,
                }))
              }
              disabled={isLoading}
              required
            />

            <label className="field-label" htmlFor="register-email">Email</label>
            <input
              id="register-email"
              className="input"
              type="email"
              placeholder="you@example.com"
              value={formState.email}
              onChange={(event) =>
                setFormState((previous) => ({
                  ...previous,
                  email: event.target.value,
                }))
              }
              disabled={isLoading}
              required
            />

            <label className="field-label" htmlFor="register-password">Password</label>
            <input
              id="register-password"
              className="input"
              type="password"
              placeholder="Create a password"
              value={formState.password}
              onChange={(event) =>
                setFormState((previous) => ({
                  ...previous,
                  password: event.target.value,
                }))
              }
              disabled={isLoading}
              required
            />

            <div className="auth-prefs-section">
              <h3>Travel preferences</h3>
              <p>Select trip styles to improve your discovery feed.</p>

              <div className="chip-row">
                {tripTypeOptions.map((tripType) => {
                  const selected = formState.tags.includes(tripType)
                  return (
                    <button
                      key={tripType}
                      type="button"
                      className={selected ? 'chip is-selected' : 'chip'}
                      disabled={isLoading}
                      onClick={() =>
                        setFormState((previous) => ({
                          ...previous,
                          tags: toggleTripType(previous.tags, tripType),
                        }))
                      }
                    >
                      {tripType}
                    </button>
                  )
                })}
              </div>

              <label className="field-label" htmlFor="register-max-members">
                Ideal max group size
              </label>
              <input
                id="register-max-members"
                className="input"
                type="number"
                min={2}
                max={30}
                value={formState.maxGroupSize}
                disabled={isLoading}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  setFormState((previous) => ({
                    ...previous,
                    maxGroupSize: Number.isFinite(value) ? value : 8,
                  }))
                }}
              />
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
                  Creating account...
                </span>
              ) : (
                'Create account'
              )}
            </button>

            <p className="auth-footer-note">
              Already have an account?{' '}
              <Link to="/login" className="text-link">Sign in</Link>
            </p>
          </form>
        </div>

        <aside className="auth-illustration-side" aria-hidden="true">
          <img
            src="/newstickers/sticker2.png"
            alt=""
            className="auth-sticker"
          />
        </aside>
      </div>
    </section>
  )
}
