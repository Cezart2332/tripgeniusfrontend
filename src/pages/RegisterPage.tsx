import { useState } from 'react'
import type { FormEvent } from 'react'
import { tripTypeOptions } from '../data/mockData'
import type {
  BudgetTier,
  GroupPreference,
  Pace,
  UserPreferences,
} from '../types/models'

interface RegisterState {
  fullName: string
  email: string
  password: string
  preferences: UserPreferences
}

const toggleTripType = (current: string[], type: string): string[] =>
  current.includes(type)
    ? current.filter((item) => item !== type)
    : [...current, type]

const createInitialState = (): RegisterState => ({
  fullName: '',
  email: '',
  password: '',
  preferences: {
    tripTypes: ['adventure', 'nature'],
    groupPreference: 'narrow',
    maxGroupSize: 8,
    budgetTier: 'medium',
    pace: 'balanced',
  },
})

export function RegisterPage() {
  const [formState, setFormState] = useState<RegisterState>(createInitialState)
  const [created, setCreated] = useState(false)

  const updateBudget = (budgetTier: BudgetTier) => {
    setFormState((previous) => ({
      ...previous,
      preferences: {
        ...previous.preferences,
        budgetTier,
      },
    }))
  }

  const updatePace = (pace: Pace) => {
    setFormState((previous) => ({
      ...previous,
      preferences: {
        ...previous.preferences,
        pace,
      },
    }))
  }

  const updateGroupPreference = (groupPreference: GroupPreference) => {
    setFormState((previous) => ({
      ...previous,
      preferences: {
        ...previous.preferences,
        groupPreference,
      },
    }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreated(true)
  }

  return (
    <section className="page register-page">
      <form className="register-layout" onSubmit={handleSubmit}>
        <div className="panel">
          <p className="eyebrow">Create account</p>
          <h1>Register and configure your trip onboarding.</h1>

          <label className="field-label" htmlFor="register-name">
            Full name
          </label>
          <input
            id="register-name"
            className="input"
            type="text"
            placeholder="Your name"
            value={formState.fullName}
            onChange={(event) =>
              setFormState((previous) => ({
                ...previous,
                fullName: event.target.value,
              }))
            }
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
            required
          />
        </div>

        <div className="panel">
          <p className="eyebrow">Onboarding preferences</p>
          <h2>What type of trips do you prefer?</h2>

          <div className="chip-row">
            {tripTypeOptions.map((tripType) => {
              const selected = formState.preferences.tripTypes.includes(tripType)
              return (
                <button
                  key={tripType}
                  type="button"
                  className={selected ? 'chip is-selected' : 'chip'}
                  onClick={() =>
                    setFormState((previous) => ({
                      ...previous,
                      preferences: {
                        ...previous.preferences,
                        tripTypes: toggleTripType(
                          previous.preferences.tripTypes,
                          tripType,
                        ),
                      },
                    }))
                  }
                >
                  {tripType}
                </button>
              )
            })}
          </div>

          <h2>Do you prefer a narrow or big group?</h2>
          <div className="choice-row">
            <button
              type="button"
              className={
                formState.preferences.groupPreference === 'narrow'
                  ? 'choice-card is-active'
                  : 'choice-card'
              }
              onClick={() => updateGroupPreference('narrow')}
            >
              Narrow group
            </button>
            <button
              type="button"
              className={
                formState.preferences.groupPreference === 'big'
                  ? 'choice-card is-active'
                  : 'choice-card'
              }
              onClick={() => updateGroupPreference('big')}
            >
              Big group
            </button>
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
            value={formState.preferences.maxGroupSize}
            onChange={(event) => {
              const value = Number(event.target.value)
              setFormState((previous) => ({
                ...previous,
                preferences: {
                  ...previous.preferences,
                  maxGroupSize: Number.isFinite(value) ? value : 8,
                },
              }))
            }}
          />

          <div className="select-row">
            <label className="field-label" htmlFor="register-budget">
              Budget tier
            </label>
            <select
              id="register-budget"
              className="input"
              value={formState.preferences.budgetTier}
              onChange={(event) =>
                updateBudget(event.target.value as BudgetTier)
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>

            <label className="field-label" htmlFor="register-pace">
              Travel pace
            </label>
            <select
              id="register-pace"
              className="input"
              value={formState.preferences.pace}
              onChange={(event) => updatePace(event.target.value as Pace)}
            >
              <option value="chill">Chill</option>
              <option value="balanced">Balanced</option>
              <option value="fast">Fast</option>
            </select>
          </div>

          <button className="btn btn-primary" type="submit">
            Register and save onboarding
          </button>

          {created ? (
            <p className="info-banner">
              Account and onboarding preferences saved in mock mode.
            </p>
          ) : null}
        </div>
      </form>
    </section>
  )
}
