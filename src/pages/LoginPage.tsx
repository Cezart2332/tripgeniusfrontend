import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { GoogleLogin } from '@react-oauth/google'
import styled from 'styled-components'
import { FiLogIn } from 'react-icons/fi'
import { AxiosError } from 'axios'
import api from '../data/api'
import { setCredentials, setToken } from '../data/authSlice'
import { ToastContainer } from '../components/shared/Toast'
import { FieldHint } from '../components/shared/FieldHint'
import { useToast } from '../components/shared/useToast'
import waitForBackendButtonUnlock from '../utils/interactionDelay'
import { subscribeForNotifications } from '../utils/notifications'
import { usePWAInstall } from '../hooks/usePWAInstall'
import { PWAInstallPopup } from '../components/PWAInstallPopup'

const GoogleIconSvg = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.2 0-5.8-2.6-5.8-6s2.6-6 5.8-6c1.8 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 6.9 2.4 2.8 6.5 2.8 11.6S6.9 20.8 12 20.8c6.9 0 9.1-4.8 9.1-7.3 0-.5-.1-.9-.1-1.3H12z"/>
  </svg>
)

const Page = styled.section`
  width: min(1040px, 100% - 2rem);
  margin: 0 auto;
  padding: 3rem 0;
  min-height: 86dvh;
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: 4rem 0 2rem;
  }
`

const Split = styled.div`
  display: grid;
  grid-template-columns: minmax(300px, 0.88fr) minmax(0, 1fr);
  width: 100%;
  align-items: center;
  gap: 4rem;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
`

const FormSide = styled.div`
  flex: 1;
  max-width: 440px;
  width: 100%;
  padding: 0 2.5rem 0 0;
  border-right: 1px solid ${({ theme }) => theme.colors.lineSoft};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    max-width: none;
    padding: 0;
    border-right: 0;
  }
`

const Illustration = styled.aside`
  flex: 1;
  min-height: 30rem;
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
  filter: drop-shadow(0 18px 42px rgba(31, 45, 36, 0.18));
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
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: rgba(255, 255, 255, 0.75);
  margin-bottom: 1.5rem;
`

const TabLink = styled(Link)<{ $active: boolean }>`
  padding: 0.45rem 1.1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 700;
  text-decoration: none;
  color: ${({ $active, theme }) => $active ? theme.colors.bg[980] : theme.colors.text[380]};
  background: ${({ $active, theme }) => $active ? `${theme.colors.green[400]}` : 'transparent'};
  box-shadow: ${({ $active, theme }) => $active ? theme.shadows.glowGreen : 'none'};
  transition: all 0.2s ease;

  &:hover:not([style]) {
    color: ${({ theme }) => theme.colors.text[220]};
    background: rgba(46, 141, 84, 0.08);
  }
`

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const GoogleWrap = styled.div`
  position: relative;
  overflow: hidden;
`

const GoogleBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.65rem 1rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: rgba(28, 43, 32, 0.04);
  color: ${({ theme }) => theme.colors.text[100]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  min-height: 44px;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    background: rgba(28, 43, 32, 0.08);
    border-color: ${({ theme }) => theme.colors.line};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const GoogleOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0.001;
  z-index: 10;
`

const GoogleScaled = styled.div`
  transform: scale(10);
  transform-origin: top left;
`

const Divider = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: ${({ theme }) => theme.colors.text[500]};
  font-size: ${({ theme }) => theme.typography.caption};
  margin: 0.25rem 0;

  &::before, &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: ${({ theme }) => theme.colors.lineSoft};
  }
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
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: ${({ theme }) => theme.colors.surface[860]};
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
  gap: 0.5rem;
  padding: 0.7rem 1.5rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.green[400]};
  color: ${({ theme }) => theme.colors.bg[980]};
  font-weight: 700;
  font-size: ${({ theme }) => theme.typography.body};
  min-height: 44px;
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};
  transition: box-shadow 0.15s ease;

  &:hover:not(:disabled) {
    box-shadow: ${({ theme }) => theme.shadows.glowGreen};
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
  border-top-color: #ffffff;
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
  color: ${({ theme }) => theme.colors.green[300]};
  font-weight: 600;
  text-decoration: none;

  &:hover { text-decoration: underline; }
`

export function LoginPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const hasGoogleClientId = Boolean((import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { toasts, addToast, removeToast } = useToast()
  const { showInstallPopup, isIos, dismissPopup, handleInstallClick } = usePWAInstall()

  const login = async (emailValue: string, passwordValue: string) => {
    const res = await api.post('api/auth/login', { email: emailValue, password: passwordValue })
    if (!res.data?.token) throw new Error('Invalid login response')
    dispatch(setToken({ token: res.data.token }))
    const user = await api.get('/api/user/me', { headers: { Authorization: `Bearer ${res.data.token}` } })
    dispatch(setCredentials({ user: user.data, token: res.data.token }))
  }

  const loginWithGoogleCredential = async (credential: string) => {
    const res = await api.post('/api/auth/google-login', { idToken: credential })
    if (!res.data?.token) throw new Error('Invalid Google login response')
    dispatch(setToken({ token: res.data.token }))
    if (res.data?.user) { dispatch(setCredentials({ user: res.data.user, token: res.data.token })); return }
    const user = await api.get('/api/user/me', { headers: { Authorization: `Bearer ${res.data.token}` } })
    dispatch(setCredentials({ user: user.data, token: res.data.token }))
  }

  const handleGoogleSuccess = async (credentialResponse: { credential?: string | null }) => {
    if (!credentialResponse.credential) { addToast('Google login failed.', 'error'); return }
    setIsLoading(true)
    try {
      await loginWithGoogleCredential(credentialResponse.credential)
      subscribeForNotifications()
      addToast('Login successful. Redirecting...', 'success')
      navigate('/app/profile', { replace: true })
    } catch (err) {
      const msg = err instanceof AxiosError ? String(err.response?.data?.message ?? 'Google login failed') : 'Google login failed'
      addToast(msg, 'error')
    } finally {
      await waitForBackendButtonUnlock()
      setIsLoading(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isLoading) return
    setIsLoading(true)
    let ok = false
    try {
      await login(email, password)
      subscribeForNotifications()
      addToast('Login successful. Redirecting...', 'success')
      ok = true
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status !== 200) {
        addToast(String(err.response?.data?.message ?? 'Login failed'), 'error')
      } else { addToast('Could not log in. Please try again.', 'error') }
    } finally {
      await waitForBackendButtonUnlock()
      setIsLoading(false)
    }
    if (ok) navigate('/app/profile', { replace: true })
  }

  return (
    <Page>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <Split>
        <FormSide>
          <Header>
            <Title>Welcome back</Title>
            <Lead>Sign in to your account and trips.</Lead>
          </Header>
          <TabBar>
            <TabLink to="/login" $active>Login</TabLink>
            <TabLink to="/register" $active={false}>Register</TabLink>
          </TabBar>
          <Form onSubmit={handleSubmit}>
            {hasGoogleClientId ? (
              <GoogleWrap>
                <GoogleBtn type="button" disabled={isLoading}><GoogleIconSvg /> Continue with Google</GoogleBtn>
                <GoogleOverlay><GoogleScaled>
                  <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => addToast('Google login was canceled or failed.', 'error')} />
                </GoogleScaled></GoogleOverlay>
              </GoogleWrap>
            ) : (
              <GoogleBtn type="button" disabled><GoogleIconSvg /> Continue with Google</GoogleBtn>
            )}
            <Divider><span>or continue with email</span></Divider>
            <FieldLabel htmlFor="login-email">Email</FieldLabel>
            <Input id="login-email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={isLoading} required aria-describedby="login-email-hint" />
            <FieldHint id="login-email-hint" icon={false}>Use the email address you registered with.</FieldHint>
            <FieldLabel htmlFor="login-password">Password</FieldLabel>
            <Input id="login-password" type="password" placeholder="********" value={password} onChange={e => setPassword(e.target.value)} disabled={isLoading} required />
            <div style={{ textAlign: 'right' }}>
              <TextLink to="/reset-password" style={{ fontSize: '0.75rem' }}>Forgot password?</TextLink>
            </div>
            <SubmitBtn type="submit" disabled={isLoading}>
              {isLoading ? <><Spinner /> Logging in...</> : <><FiLogIn size={16} /> Enter workspace</>}
            </SubmitBtn>
            <FooterNote>New to TripGenius? <TextLink to="/register">Create your account</TextLink></FooterNote>
          </Form>
        </FormSide>
        <Illustration aria-hidden="true">
          <Sticker src="/newstickers/sticker4.png" alt="" />
        </Illustration>
      </Split>
      <PWAInstallPopup show={showInstallPopup} isIos={isIos} onDismiss={dismissPopup} onInstall={handleInstallClick} />
    </Page>
  )
}
