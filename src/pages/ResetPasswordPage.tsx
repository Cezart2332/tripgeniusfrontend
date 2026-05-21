import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import styled, { keyframes } from 'styled-components'
import { FiLock, FiMail, FiCheck } from 'react-icons/fi'
import { AxiosError } from 'axios'
import api from '../data/api'
import { setCredentials, setToken } from '../data/authSlice'
import { ToastContainer, useToast } from '../components/shared/Toast'
import waitForBackendButtonUnlock from '../utils/interactionDelay'

const spin = keyframes`
  to { transform: rotate(360deg); }
`

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

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`

const FieldLabel = styled.label`
  font-size: ${({ theme }) => theme.typography.caption};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.text[380]};
`

const InputWrapper = styled.div`
  position: relative;
`

const InputIcon = styled.span`
  position: absolute;
  left: ${({ theme }) => theme.spacing.md};
  top: 50%;
  transform: translateY(-50%);
  color: ${({ theme }) => theme.colors.text[380]};
  display: flex;
  align-items: center;
`

const Input = styled.input`
  width: 100%;
  padding: 0.7rem ${({ theme }) => theme.spacing.md};
  padding-left: 2.8rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.glass.border};
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

const SubmitBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.sm};
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
  animation: ${spin} 0.6s linear infinite;
`

const FooterNote = styled.p`
  text-align: center;
  color: ${({ theme }) => theme.colors.text[380]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  margin-top: ${({ theme }) => theme.spacing.lg};
`

const TextLink = styled(Link)`
  color: ${({ theme }) => theme.colors.green[500]};
  font-weight: 600;
  text-decoration: none;

  &:hover { text-decoration: underline; }
`

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
  const { toasts, addToast, removeToast } = useToast()

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      addToast('Passwords do not match.', 'error')
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
          addToast('Password reset successfully!', 'success')
          navigate('/app/profile', { replace: true })
        }, 1500)
      }
      addToast('Password reset successful!', 'success')
      setPassword('')
      setConfirmPassword('')
    } catch (error: unknown) {
      if (error instanceof AxiosError) {
        const message = error.response?.data?.message || error.response?.data || 'Could not reset password. Please try again.'
        addToast(String(message), 'error')
      } else {
        addToast('Could not reset password. Please try again.', 'error')
      }
    } finally {
      await waitForBackendButtonUnlock()
      setIsLoading(false)
    }
  }

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setIsLoading(true)

    try {
      await api.post('/api/auth/forgot-password', { email })
      addToast('If this email exists, a reset link has been sent.', 'success')
    } catch (error: unknown) {
      if (error instanceof AxiosError) {
        const message = error.response?.data?.message || error.response?.data || 'Could not send reset email. Please try again.'
        addToast(String(message), 'error')
      } else {
        addToast('Could not send reset email. Please try again.', 'error')
      }
    } finally {
      await waitForBackendButtonUnlock()
      setIsLoading(false)
    }
  }

  return (
    <Page>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <Split>
        <FormSide>
          <Header>
            <Title>{isResetWithToken ? 'Reset your password' : 'Forgot password?'}</Title>
            <Lead>
              {isResetWithToken
                ? 'Create a new secure password for your account.'
                : 'Enter your email and we will send you a password reset link.'}
            </Lead>
          </Header>

          {isResetWithToken ? (
            <Form onSubmit={handlePasswordResetSubmit}>
              <FieldLabel htmlFor="new-password">New Password</FieldLabel>
              <InputWrapper>
                <InputIcon>
                  <FiLock size={16} />
                </InputIcon>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </InputWrapper>

              <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
              <InputWrapper>
                <InputIcon>
                  <FiLock size={16} />
                </InputIcon>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="********"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </InputWrapper>

              <SubmitBtn type="submit" disabled={isLoading}>
                {isLoading ? <><Spinner /> Updating password...</> : <><FiCheck size={16} /> Update Password</>}
              </SubmitBtn>
            </Form>
          ) : (
            <Form onSubmit={handleForgotPasswordSubmit}>
              <FieldLabel htmlFor="forgot-password-email">Email</FieldLabel>
              <InputWrapper>
                <InputIcon>
                  <FiMail size={16} />
                </InputIcon>
                <Input
                  id="forgot-password-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </InputWrapper>

              <SubmitBtn type="submit" disabled={isLoading}>
                {isLoading ? <><Spinner /> Sending reset link...</> : <><FiMail size={16} /> Send reset link</>}
              </SubmitBtn>
            </Form>
          )}

          <FooterNote>
            <TextLink to="/login">Back to login</TextLink>
          </FooterNote>
        </FormSide>

        <Illustration aria-hidden="true">
          <Sticker src="/newstickers/sticker5.png" alt="" />
        </Illustration>
      </Split>
    </Page>
  )
}
