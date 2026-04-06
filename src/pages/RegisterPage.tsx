import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { tripTypeOptions } from '../data/mockData'
import api from '../data/api'
import { useDispatch } from 'react-redux'
import { setCredentials } from '../data/authSlice'

interface RegisterState {
  username: string
  email: string
  password: string
  tags: string[]
  groupSize: number
}

const registerHighlights = [
  'Build your onboarding profile in one pass.',
  'Set trip styles to improve your discovery feed quality.',
  'Define ideal group size before joining or creating trips.',
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

const toggleTripType = (current: string[], type: string): string[] =>
  current.includes(type)
    ? current.filter((item) => item !== type)
    : [...current, type]

const createInitialState = (): RegisterState => ({
  username: '',
  email: '',
  password: '',
  tags: ['adventure', 'nature'],
  groupSize: 8,
})

export function RegisterPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [formState, setFormState] = useState<RegisterState>(createInitialState)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const register = async (
    username: string,
    email: string,
    password: string,
    tags: string[],
    groupSize: number,
  ) => {
    const res = await api.post('api/auth/register', {
      email,
      password,
      username,
      tags,
      groupSize,
    })

    const user = await api.get('api/user/me')
    dispatch(
      setCredentials({
        user: user.data,
        token: res.data.token,
      }),
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setIsLoading(true)

    try {
      await register(
        formState.username,
        formState.email,
        formState.password,
        formState.tags,
        formState.groupSize,
      )
      navigate('/profile', { replace: true })
    } catch (error) {
      setErrorMessage(
        getRequestErrorMessage(
          error,
          'Could not register your account. Please try again in a moment.',
        ),
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="page register-page">
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
            value={formState.groupSize}
            disabled={isLoading}
            onChange={(event) => {
              const value = Number(event.target.value)
              setFormState((previous) => ({
                ...previous,
                groupSize: Number.isFinite(value) ? value : 8,
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

          {errorMessage ? <p className="info-banner is-error">{errorMessage}</p> : null}
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
