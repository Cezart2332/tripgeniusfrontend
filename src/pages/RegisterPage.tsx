import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { tripTypeOptions } from '../data/mockData'
import api from '../data/api'
import { useDispatch } from 'react-redux'
import { setCredentials,setToken } from '../data/authSlice'
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

const registerHighlights = [
  'Build your onboarding profile in one pass.',
  'Set trip styles to improve your discovery feed quality.',
  'Define ideal group size before joining or creating trips.',
]


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
  const dispatch = useDispatch()
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
    console.log(maxGroupSize)
    const res = await api.post('api/auth/register', {
      email,
      password,
      username,
      tags,
      maxGroupSize,
    })

    dispatch(setToken({token:res.data.token}))

    const user = await api.get('api/user/me', {headers: { Authorization: `Bearer ${res.data.token}` } })
    dispatch(
      setCredentials({
        user: user.data,
        token: res.data.token,
      }),
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isLoading) {
      return
    }

    setIsLoading(true)
    let shouldNavigate = false

    try 
    {
      await register(
        formState.username,
        formState.email,
        formState.password,
        formState.tags,
        formState.maxGroupSize,
      )
      showToast('Account created. Redirecting to your profile...', 'success')
      shouldNavigate = true
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

    if (shouldNavigate) {
      navigate('/profile', { replace: true })
    }
  }

  return (
    <section className="page register-page">
      <FeedbackToast toast={toast} clearToast={() => setToast(null)} />
      <header className="panel auth-headline">
        <p className="eyebrow">Start your expedition</p>
        <h1>Create your basecamp profile.</h1>
        <p>
          Register once, set your travel preferences, and unlock personalized trip discovery.
        </p>
      </header>

      <nav className="auth-switch" aria-label="Authentication pages">
        <Link className="auth-switch-link" to="/login">
          Login
        </Link>
        <Link className="auth-switch-link is-active" to="/register">
          Register
        </Link>
      </nav>

      <div className="auth-flow">
        <form className="panel auth-form-rail" onSubmit={handleSubmit}>
          <h2>Account details</h2>

          <label className="field-label" htmlFor="register-name">
            Username
          </label>
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

          <label className="field-label" htmlFor="register-email">
            Email
          </label>
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

          <label className="field-label" htmlFor="register-password">
            Password
          </label>
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

          <h2>Onboarding preferences</h2>
          <p>Select the trip styles you care about most.</p>

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
            Maximum members in your ideal group
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
              'Create account and continue'
            )}
          </button>
        </form>

        <aside className="panel auth-side-rail">
          <h2>What happens next?</h2>
          <ul className="auth-point-list">
            {registerHighlights.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>

          <p className="lead">Already have an account?</p>
          <Link to="/login" className="btn btn-ghost">
            Sign in instead
          </Link>
        </aside>
      </div>
    </section>
  )
}
