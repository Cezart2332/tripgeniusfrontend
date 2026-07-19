import { type MouseEvent } from 'react'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import styled from 'styled-components'
import { FiArrowRight, FiCompass, FiMap, FiMessageCircle, FiUsers, FiWifiOff } from 'react-icons/fi'
import type { IconType } from 'react-icons'
import { ToastContainer } from '../components/shared/Toast'
import { useToast } from '../components/shared/useToast'
import type { User } from '../types/models'

interface AuthStoreState {
  auth: { user: User | null; token: string | null }
}

interface Feature {
  title: string; description: string; Icon: IconType
}

const features: Feature[] = [
  { title: 'Group operations', description: 'Manage routes, roles, and logistics in one place.', Icon: FiUsers },
  { title: 'Smart discovery', description: 'Find travelers whose style matches your plan.', Icon: FiCompass },
  { title: 'Offline ready', description: 'Keep trip context available without a connection.', Icon: FiWifiOff },
]

const steps = [
  { num: '01', title: 'Define your travel DNA', sub: 'Set preferred styles and ideal group size.' },
  { num: '02', title: 'Launch or join a trip', sub: 'Create an itinerary or enter a workspace.' },
  { num: '03', title: 'Coordinate together', sub: 'Map, timeline, members, and chat as one.' },
]

const Page = styled.section`
  width: min(1240px, 100% - 2rem);
  margin: 0 auto;
  padding: 1.5rem 0 7rem;
  display: flex;
  flex-direction: column;
  gap: 6.5rem;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: 1.5rem 0 4rem;
    gap: 4rem;
  }
`

const Hero = styled(motion.header)`
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(280px, 0.75fr);
  align-items: center;
  gap: 4rem;
  min-height: calc(100dvh - 7rem);
  padding: 2rem 0 4rem;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 10% -8% auto 44%;
    height: 70%;
    pointer-events: none;
    opacity: 0.8;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
    gap: 2.5rem;
    padding: 1rem 0 2rem;
    min-height: auto;
  }
`

const HeroText = styled.div`
  flex: 1;
  max-width: 620px;
  align-self: center;
  position: relative;
  z-index: 1;
`

const Eyebrow = styled.p`
  font-size: ${({ theme }) => theme.typography.eyebrow};
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme.colors.offroad.accent};
  margin-bottom: 0.75rem;
`

const HeroTitle = styled.h1`
  font-size: 4rem;
  letter-spacing: 0;
  line-height: 0.98;
  margin-bottom: 1rem;
  color: ${({ theme }) => theme.colors.text[100]};

  span {
    background: ${({ theme }) => theme.colors.green[500]};
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    font-size: 2.7rem;
  }
`

const Lead = styled.p`
  font-size: ${({ theme }) => theme.typography.body};
  color: ${({ theme }) => theme.colors.text[380]};
  max-width: 58ch;
  margin-bottom: 1.5rem;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    max-width: none;
    margin-left: auto;
    margin-right: auto;
  }
`

const ActionsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    justify-content: center;
  }
`

const PrimaryLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.8rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.green[400]};
  color: ${({ theme }) => theme.colors.bg[980]};
  font-weight: 700;
  font-size: 0.95rem;
  text-decoration: none;
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};
  transition: box-shadow 0.2s ease, transform 0.2s ease;
  min-height: 48px;

  &:hover {
    transform: translateY(-1px);
    box-shadow: ${({ theme }) => theme.shadows.glowGreen};
  }
`

const GhostLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.5rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  color: ${({ theme }) => theme.colors.text[220]};
  font-weight: 600;
  font-size: 0.925rem;
  text-decoration: none;
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  background: transparent;
  transition: all 0.2s ease;
  min-height: 48px;

  &:hover {
    border-color: ${({ theme }) => theme.colors.line};
    background: rgba(28, 43, 32, 0.06);
    color: ${({ theme }) => theme.colors.text[100]};
  }
`

const HeroIllustration = styled.div`
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  min-height: 24rem;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    min-height: 14rem;
  }
`

const HeroSticker = styled.img`
  width: 100%;
  max-width: 360px;
  height: auto;
  opacity: 0.85;
  filter: drop-shadow(0 18px 42px rgba(31, 45, 36, 0.18));

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    max-width: 200px;
  }
`

const SectionHeader = styled.div`
  text-align: left;
  margin-bottom: 2.5rem;
  max-width: 38rem;
`

const SectionTitle = styled.h2`
  color: ${({ theme }) => theme.colors.text[100]};
  margin-bottom: 0.5rem;
`

const SectionLead = styled.p`
  color: ${({ theme }) => theme.colors.text[380]};
  font-size: ${({ theme }) => theme.typography.body};
`

const FeatureGrid = styled(motion.section)`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  border-top: 1px solid ${({ theme }) => theme.colors.lineSoft};
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineSoft};

  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    grid-template-columns: 1fr;
    border-bottom: 0;
  }
`

const FeatureCard = styled(motion.article)`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  padding: 2rem 2rem 2rem 0;
  border-right: 1px solid ${({ theme }) => theme.colors.lineSoft};
  gap: 0.75rem;
  transition: color 0.3s ease, transform 0.3s ease;

  &:not(:first-child) {
    padding-left: 2rem;
  }

  &:last-child {
    border-right: 0;
  }

  &:hover {
    transform: translateY(-2px);
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    padding: 1.5rem 0;
    border-right: 0;
    border-bottom: 1px solid ${({ theme }) => theme.colors.lineSoft};

    &:not(:first-child) {
      padding-left: 0;
    }
  }
`

const FeatureIcon = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: ${({ theme }) => theme.radii.md};
  background: rgba(168, 120, 31, 0.12);
  color: ${({ theme }) => theme.colors.offroad.accent};
  font-size: 1.3rem;
  margin-bottom: 0.25rem;
`

const FeatureTitle = styled.h3`
  color: ${({ theme }) => theme.colors.text[100]};
`

const FeatureDesc = styled.p`
  color: ${({ theme }) => theme.colors.text[380]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  line-height: 1.5;
`

const StepsWrap = styled(motion.section)`
  display: flex;
  flex-direction: column;
  gap: 2rem;
`

const StepsList = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;

  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    grid-template-columns: 1fr;
  }
`

const StepCard = styled(motion.div)`
  display: flex;
  gap: 1rem;
  padding: 1.5rem 1.5rem 1.5rem 0;
  border-top: 1px solid ${({ theme }) => theme.colors.lineSoft};

  &:not(:first-child) {
    padding-left: 1.5rem;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    padding: 1.25rem 0;

    &:not(:first-child) {
      padding-left: 0;
    }
  }
`

const StepNum = styled.span`
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: 0;
  color: ${({ theme }) => theme.colors.offroad.accent};
  line-height: 1;
  flex-shrink: 0;
  opacity: 0.6;
`

const StepContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
`

const StepTitle = styled.h3`
  color: ${({ theme }) => theme.colors.text[100]};
`

const StepSub = styled.p`
  color: ${({ theme }) => theme.colors.text[380]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  line-height: 1.5;
`

const CTAWrap = styled(motion.section)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  padding: 3rem 0 0;
  border-top: 1px solid ${({ theme }) => theme.colors.lineSoft};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex-direction: column;
    text-align: left;
    align-items: flex-start;
    padding-top: 2rem;
  }
`

const CTAContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const CTATitle = styled.h2`
  color: ${({ theme }) => theme.colors.text[100]};
`

const CTADesc = styled.p`
  color: ${({ theme }) => theme.colors.text[380]};
  font-size: ${({ theme }) => theme.typography.body};
`

const CTAAside = styled.div`
  flex-shrink: 0;
`

const MiniCards = styled.div`
  display: flex;
  gap: 0.75rem;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex-direction: column;
  }
`

const MiniCard = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.85rem;
  border-radius: ${({ theme }) => theme.radii.md};
  background: rgba(28, 43, 32, 0.055);
  border: 1px solid ${({ theme }) => theme.glass.border};
  color: ${({ theme }) => theme.colors.text[220]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  white-space: nowrap;

  svg {
    color: ${({ theme }) => theme.colors.offroad.accent};
    font-size: 1rem;
  }
`

export function LandingPage() {
  const navigate = useNavigate()
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const { toasts, addToast, removeToast } = useToast()

  const handleCreateAccountClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (user) {
      e.preventDefault()
      addToast('No need to create a new account, you are already logged in', 'info')
    }
  }

  const handleGetStartedClick = async (e: MouseEvent<HTMLAnchorElement>) => {
    if (user) {
      e.preventDefault()
      navigate('/app/profile')
    }
  }

  return (
    <Page>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <Hero initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
        <HeroText>
          <Eyebrow>TripGenius</Eyebrow>
          <HeroTitle>
            Plan trips like a<br />
            <span>travel crew.</span>
          </HeroTitle>
          <Lead>
            Centralize route planning, member coordination, and travel ops --
            your group moves from idea to departure without scattered tools.
          </Lead>
          <ActionsRow>
            <PrimaryLink to="/register" onClick={handleGetStartedClick}>
              Get started <FiArrowRight />
            </PrimaryLink>
            <GhostLink to="/app/discover">Explore trips</GhostLink>
          </ActionsRow>
        </HeroText>
        <HeroIllustration aria-hidden="true">
          <HeroSticker src="/newstickers/sticker1.png" alt="" />
        </HeroIllustration>
      </Hero>

      <FeatureGrid
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
      >
        {features.map((f) => (
          <FeatureCard
            key={f.title}
            variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } }}
          >
            <FeatureIcon><f.Icon /></FeatureIcon>
            <FeatureTitle>{f.title}</FeatureTitle>
            <FeatureDesc>{f.description}</FeatureDesc>
          </FeatureCard>
        ))}
      </FeatureGrid>

      <StepsWrap
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
      >
        <SectionHeader>
          <SectionTitle>How it works</SectionTitle>
          <SectionLead>Three steps to your next adventure.</SectionLead>
        </SectionHeader>
        <StepsList>
          {steps.map((step) => (
            <StepCard
              key={step.num}
              variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } }}
            >
              <StepNum>{step.num}</StepNum>
              <StepContent>
                <StepTitle>{step.title}</StepTitle>
                <StepSub>{step.sub}</StepSub>
              </StepContent>
            </StepCard>
          ))}
        </StepsList>
      </StepsWrap>

      <CTAWrap
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <CTAContent>
          <CTATitle>Ready to coordinate?</CTATitle>
          <CTADesc>Start with your profile, discover trips, or launch your own route room.</CTADesc>
          <ActionsRow style={{ marginTop: '0.5rem' }}>
            <PrimaryLink to="/register" onClick={handleCreateAccountClick}>Create account</PrimaryLink>
            <GhostLink to="/app/discover">Browse trips</GhostLink>
          </ActionsRow>
        </CTAContent>
        <CTAAside aria-hidden="true">
          <MiniCards>
            <MiniCard><FiMap /> Route clarity</MiniCard>
            <MiniCard><FiMessageCircle /> Live chat</MiniCard>
            <MiniCard><FiUsers /> Role controls</MiniCard>
          </MiniCards>
        </CTAAside>
      </CTAWrap>
    </Page>
  )
}
