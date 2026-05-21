import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { AxiosError } from 'axios'
import { tripTypeOptions } from '../data/tripTypeOptions'
import api from '../data/api'
import { ToastContainer, useToast } from '../components/shared/Toast'
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

const Page = styled.section`
  width: min(960px, 100% - 2rem);
  margin: 0 auto;
  padding: 2rem 0;
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: 4rem 0 2rem;
  }
`

const Split = styled.div`
  display: flex;
  width: 100%;
  align-items: center;
  gap: 3rem;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex-direction: column;
    gap: 1.5rem;
  }
`

const FormSide = styled.div`
  flex: 1;
  max-width: 440px;
`

const Illustration = styled.aside`
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    display: none;
  }
`

const Sticker = styled.img`
  width: 240px;
  height: auto;
  opacity: 0.8;
  filter: drop-shadow(0 8px 24px rgba(23, 247, 2, 0.1));
`

const Header = styled.header`
  margin-bottom: 1.5rem;
`

const Title = styled.h1`
  color: ${({ theme }) => theme.colors.text[100]};
  margin-bottom: 0.3rem;
`

const Lead = styled.p`
  color: ${({ theme }) => theme.colors.text[380]};
  font-size: ${({ theme }) => theme.typography.body};
`

const TabBar = styled.nav`
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.25rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: rgba(9, 14, 10, 0.75);
  margin-bottom: 1.5rem;
`

const TabLink = styled(Link)<{ $active: boolean }>`
  padding: 0.45rem 1.1rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 700;
  text-decoration: none;
  color: ${({ $active, theme }) => $active ? '#0a1e08' : theme.colors.text[380]};
  background: ${({ $active, theme }) => $active ? `linear-gradient(135deg, ${theme.colors.green[580]}, ${theme.colors.green[500]})` : 'transparent'};
  box-shadow: ${({ $active }) => $active ? `0 2px 12px rgba(23, 247, 2, 0.2)` : 'none'};
  transition: all 0.2s ease;

  &:hover:not([style]) {
    color: ${({ theme }) => theme.colors.text[220]};
    background: rgba(65, 162, 56, 0.08);
  }
`

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const FieldLabel = styled.label`
  font-size: ${({ theme }) => theme.typography.caption};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.text[380]};
`

const Input = styled.input`
  width: 100%;
  padding: 0.7rem 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: ${({ theme }) => theme.glass.bg};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.body};
  font-family: inherit;
  min-height: 44px;
  transition: border-color 0.15s ease;

  &::placeholder { color: ${({ theme }) => theme.colors.text[500]}; }
  &:focus { outline: none; border-color: ${({ theme }) => theme.colors.green[500]}; }
  &:disabled { opacity: 0.5; }
`

const PrefsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const SectionHeading = styled.h3`
  color: ${({ theme }) => theme.colors.text[100]};
  margin-bottom: 0.15rem;
`

const SectionDescription = styled.p`
  color: ${({ theme }) => theme.colors.text[380]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  margin-bottom: 0.25rem;
`

const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`

const Chip = styled.button<{ $selected: boolean }>`
  padding: 0.4rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid ${({ $selected, theme }) => $selected ? 'transparent' : theme.colors.lineSoft};
  background: ${({ $selected, theme }) =>
    $selected
      ? `linear-gradient(135deg, ${theme.colors.green[580]}, ${theme.colors.green[500]})`
      : 'transparent'};
  color: ${({ $selected, theme }) => $selected ? '#0a1e08' : theme.colors.text[380]};
  font-size: ${({ theme }) => theme.typography.caption};
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    border-color: ${({ $selected, theme }) => $selected ? 'transparent' : theme.colors.line};
    color: ${({ $selected, theme }) => $selected ? '#0a1e08' : theme.colors.text[220]};
    background: ${({ $selected, theme }) =>
      $selected
        ? `linear-gradient(135deg, ${theme.colors.green[580]}, ${theme.colors.green[500]})`
        : 'rgba(65, 162, 56, 0.08)'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const SubmitBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.7rem 1.5rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: #0a1e08;
  font-weight: 700;
  font-size: ${({ theme }) => theme.typography.body};
  min-height: 44px;
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};
  transition: box-shadow 0.15s ease;

  &:hover:not(:disabled) {
    box-shadow: 0 0 30px rgba(23, 247, 2, 0.2);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }
`

const Spinner = styled.span`
  width: 16px;
  height: 16px;
  border: 2px solid rgba(0, 0, 0, 0.2);
  border-top-color: #0a1e08;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  @keyframes spin { to { transform: rotate(360deg); } }
`

const FooterNote = styled.p`
  text-align: center;
  color: ${({ theme }) => theme.colors.text[380]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  margin-top: 0.5rem;
`

const TextLink = styled(Link)`
  color: ${({ theme }) => theme.colors.green[500]};
  font-weight: 600;
  text-decoration: none;

  &:hover { text-decoration: underline; }
`

export function RegisterPage() {
  const navigate = useNavigate()
  const [formState, setFormState] = useState<RegisterState>(createInitialState)
  const [isLoading, setIsLoading] = useState(false)
  const { toasts, addToast, removeToast } = useToast()

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
    addToast('Account created successfully.', 'success')
    await waitForBackendButtonUnlock(ACCOUNT_CREATED_TOAST_DELAY_MS)
    addToast(String(res?.data ?? 'Please verify your email before logging in.'), 'info')
    await waitForBackendButtonUnlock(VERIFY_EMAIL_TOAST_DELAY_MS)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isLoading) {
      return
    }

    setIsLoading(true)
    let registrationSucceeded = false

    try {
      await register(
        formState.username,
        formState.email,
        formState.password,
        formState.tags,
        formState.maxGroupSize,
      )
      registrationSucceeded = true
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        const message = err.response?.data?.message || err.response?.data || 'There was an issue, please try again later'
        addToast(String(message), 'error')
      } else {
        addToast('Could not register your account. Please try again in a moment.', 'error')
      }
    } finally {
      await waitForBackendButtonUnlock()
      setIsLoading(false)
    }

    if (registrationSucceeded) {
      navigate('/', { replace: true })
    }
  }

  return (
    <Page>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <Split>
        <FormSide>
          <Header>
            <Title>Create your account</Title>
            <Lead>Set up your profile and travel preferences in one go.</Lead>
          </Header>

          <TabBar aria-label="Authentication pages">
            <TabLink to="/login" $active={false}>Login</TabLink>
            <TabLink to="/register" $active>Register</TabLink>
          </TabBar>

          <Form onSubmit={handleSubmit}>
            <FieldLabel htmlFor="register-name">Username</FieldLabel>
            <Input
              id="register-name"
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

            <FieldLabel htmlFor="register-email">Email</FieldLabel>
            <Input
              id="register-email"
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

            <FieldLabel htmlFor="register-password">Password</FieldLabel>
            <Input
              id="register-password"
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

            <PrefsSection>
              <SectionHeading>Travel preferences</SectionHeading>
              <SectionDescription>Select trip styles to improve your discovery feed.</SectionDescription>

              <ChipRow>
                {tripTypeOptions.map((tripType) => {
                  const selected = formState.tags.includes(tripType)
                  return (
                    <Chip
                      key={tripType}
                      type="button"
                      $selected={selected}
                      disabled={isLoading}
                      onClick={() =>
                        setFormState((previous) => ({
                          ...previous,
                          tags: toggleTripType(previous.tags, tripType),
                        }))
                      }
                    >
                      {tripType}
                    </Chip>
                  )
                })}
              </ChipRow>

              <FieldLabel htmlFor="register-max-members">
                Ideal max group size
              </FieldLabel>
              <Input
                id="register-max-members"
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
            </PrefsSection>

            <SubmitBtn
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <>
                  <Spinner aria-hidden="true" />
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </SubmitBtn>

            <FooterNote>
              Already have an account?{' '}
              <TextLink to="/login">Sign in</TextLink>
            </FooterNote>
          </Form>
        </FormSide>

        <Illustration aria-hidden="true">
          <Sticker
            src="/newstickers/sticker2.png"
            alt=""
          />
        </Illustration>
      </Split>
    </Page>
  )
}
