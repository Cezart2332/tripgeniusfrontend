import { renderWithProviders } from '../test/test-utils'
import { LandingPage } from './LandingPage'
import { MemoryRouter, useLocation } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import type { User } from '../types/models'

function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

const loggedInUser: User = {
  id: 1,
  username: 'Alex',
  email: 'alex@example.com',
  profileUrl: '',
  description: '',
  tags: [],
  groupSize: 3,
  notifications: [],
  trips: [],
}

describe('LandingPage', () => {
  it('navigates logged-in users to their profile', async () => {
    const user = userEvent.setup()

    renderWithProviders(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
        <LocationDisplay />
      </MemoryRouter>,
      { preloadedState: { auth: { user: loggedInUser, token: 'token' } } },
    )

    await user.click(screen.getByRole('link', { name: /get started/i }))
    expect(screen.getByTestId('location')).toHaveTextContent('/app/profile')
  })

  it('lets anonymous users follow the register link', async () => {
    const user = userEvent.setup()

    renderWithProviders(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
        <LocationDisplay />
      </MemoryRouter>,
      { preloadedState: { auth: { user: null, token: null } } },
    )

    await user.click(screen.getByRole('link', { name: /get started/i }))
    expect(screen.getByTestId('location')).toHaveTextContent('/register')
  })
})
