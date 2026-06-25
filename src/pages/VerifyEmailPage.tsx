import { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import styled, { keyframes } from 'styled-components'
import { FiCheckCircle, FiLoader, FiMail } from 'react-icons/fi'
import { setCredentials, setToken } from '../data/authSlice'
import api from '../data/api'
import { ToastContainer } from '../components/shared/Toast'
import { useToast } from '../components/shared/useToast'

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
  filter: drop-shadow(0 8px 24px rgba(143, 179, 106, 0.1));
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

const StatusPanel = styled.div`
  padding: ${({ theme }) => theme.spacing.xl};
  border-radius: ${({ theme }) => theme.radii.xl};
  background: ${({ theme }) => theme.glass.bg};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  border: 1px solid ${({ theme }) => theme.glass.border};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  text-align: center;
`

const Spinner = styled(FiLoader)`
  font-size: 2.5rem;
  color: ${({ theme }) => theme.colors.green[580]};
  animation: ${spin} 1s linear infinite;
`

const StatusIcon = styled.span<{ $tone: 'success' | 'error' | 'idle' }>`
  font-size: 3rem;
  color: ${({ $tone, theme }) =>
    $tone === 'success' ? theme.colors.green[580] :
    $tone === 'error' ? theme.colors.danger[500] :
    theme.colors.green[580]};
`

const StatusTitle = styled.h3<{ $tone?: 'error' }>`
  margin: 0;
  color: ${({ $tone, theme }) =>
    $tone === 'error' ? theme.colors.danger[500] : theme.colors.text[100]};
`

const StatusMessage = styled.p`
  color: ${({ theme }) => theme.colors.text[380]};
`

const PrimaryBtn = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: 0.7rem 1.5rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: #10120f;
  font-weight: 700;
  font-size: ${({ theme }) => theme.typography.body};
  min-height: 44px;
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};
  text-decoration: none;
  width: 100%;
  margin-top: ${({ theme }) => theme.spacing.sm};
  transition: box-shadow 0.15s ease;

  &:hover {
    box-shadow: 0 0 30px rgba(143, 179, 106, 0.2);
  }
`

const FooterNote = styled.p`
  text-align: center;
  color: ${({ theme }) => theme.colors.text[380]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  margin-top: ${({ theme }) => theme.spacing.md};
`

const TextLink = styled(Link)`
  color: ${({ theme }) => theme.colors.green[500]};
  font-weight: 600;
  text-decoration: none;

  &:hover { text-decoration: underline; }
`

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>(token ? 'verifying' : 'idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { toasts, addToast, removeToast } = useToast()

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
            addToast('Email verified successfully!', 'success')
            navigate('/app/profile', { replace: true })
          }, 1500)
        }
      } catch (error) {
        console.error('Email verification failed:', error)
        setStatus('error')
        setErrorMessage('Verification failed. The link may be expired or invalid.')
        addToast('Verification failed.', 'error')
      }
    }

    verifyEmail()
  }, [token, dispatch, navigate, addToast])

  return (
    <Page>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <Split>
        <FormSide>
          <Header>
            <Title>{token ? 'Verifying your account' : 'Verify your email'}</Title>
            <Lead>
              {token
                ? 'Please wait while we confirm your credentials with our secure servers.'
                : 'We need to verify your email address before you can access all features.'}
            </Lead>
          </Header>

          {token ? (
            <StatusPanel>
              {status === 'verifying' && (
                <>
                  <Spinner />
                  <StatusMessage>Loading your travel data...</StatusMessage>
                </>
              )}
              {status === 'success' && (
                <>
                  <StatusIcon as={FiCheckCircle} $tone="success" />
                  <StatusTitle>Verification Complete!</StatusTitle>
                  <StatusMessage>Your account is now fully active. Ready for your next adventure?</StatusMessage>
                  <PrimaryBtn to="/login">Go to Login</PrimaryBtn>
                </>
              )}
              {status === 'error' && (
                <>
                  <StatusIcon as={FiMail} $tone="error" />
                  <StatusTitle $tone="error">Verification Failed</StatusTitle>
                  <StatusMessage>{errorMessage}</StatusMessage>
                  <PrimaryBtn to="/login">Back to Login</PrimaryBtn>
                </>
              )}
            </StatusPanel>
          ) : (
            <StatusPanel>
              <StatusIcon as={FiMail} $tone="idle" />
              <StatusMessage>No verification link provided.</StatusMessage>
              <PrimaryBtn to="/login">Go to Login</PrimaryBtn>
            </StatusPanel>
          )}

          <FooterNote>
            <TextLink to="/login">Back to login</TextLink>
          </FooterNote>
        </FormSide>

        <Illustration aria-hidden="true">
          <Sticker src="/newstickers/sticker4.png" alt="" />
        </Illustration>
      </Split>
    </Page>
  )
}
