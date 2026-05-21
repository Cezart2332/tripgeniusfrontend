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
  width: min(1000px, 100% - 2rem);
  margin: 0 auto;
  padding: 3rem 0 6rem;
  display: flex;
  flex-direction: column;
  gap: 5rem;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: 1.5rem 0 4rem;
    gap: 3.5rem;
  }
`

const Hero = styled(motion.header)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 3rem;
  padding-top: 1rem;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex-direction: column-reverse;
    text-align: center;
    gap: 2rem;
    padding-top: 3rem;
  }
`

const HeroText = styled.div`
  flex: 1;
  max-width: 540px;
`

const Eyebrow = styled.p`
  font-size: ${({ theme }) => theme.typography.eyebrow};
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${({ theme }) => theme.colors.green[500]};
  margin-bottom: 0.75rem;
`

const HeroTitle = styled.h1`
  font-size: clamp(2.2rem, 5vw, 3.4rem);
  letter-spacing: -0.03em;
  line-height: 1.08;
  margin-bottom: 1rem;
  color: ${({ theme }) => theme.colors.text[100]};

  span {
    background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[500]}, ${({ theme }) => theme.colors.green[300]});
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
`

const Lead = styled.p`
  font-size: ${({ theme }) => theme.typography.body};
  color: ${({ theme }) => theme.colors.text[380]};
  max-width: 440px;
  line-height: 1.6;
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
  border-radius: ${({ theme }) => theme.radii.pill};
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: #0a1e08;
  font-weight: 700;
  font-size: 0.95rem;
  text-decoration: none;
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};
  transition: box-shadow 0.2s ease, transform 0.2s ease;
  min-height: 48px;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 0 40px rgba(23, 247, 2, 0.25);
  }
`

const GhostLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.5rem;
  border-radius: ${({ theme }) => theme.radii.pill};
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
    background: rgba(65, 162, 56, 0.06);
    color: ${({ theme }) => theme.colors.text[100]};
  }
`

const HeroIllustration = styled.div`
  flex-shrink: 0;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: 180px;
  }
`

const HeroSticker = styled.img`
  width: 100%;
  max-width: 320px;
  height: auto;
  opacity: 0.85;
  filter: drop-shadow(0 8px 32px rgba(23, 247, 2, 0.12));

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    max-width: 200px;
  }
`

const SectionHeader = styled.div`
  text-align: center;
  margin-bottom: 2.5rem;
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
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;

  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    grid-template-columns: 1fr;
    max-width: 440px;
    margin: 0 auto;
  }
`

const FeatureCard = styled(motion.article)`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.75rem 1.5rem;
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  -webkit-backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  border-radius: ${({ theme }) => theme.radii.xl};
  gap: 0.75rem;
  transition: border-color 0.3s ease, transform 0.3s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.line};
    transform: translateY(-2px);
  }
`

const FeatureIcon = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: ${({ theme }) => theme.radii.md};
  background: rgba(23, 247, 2, 0.08);
  color: ${({ theme }) => theme.colors.green[500]};
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
  gap: 1.5rem;

  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    grid-template-columns: 1fr;
    max-width: 440px;
    margin: 0 auto;
  }
`

const StepCard = styled(motion.div)`
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  -webkit-backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  border-radius: ${({ theme }) => theme.radii.xl};
`

const StepNum = styled.span`
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: ${({ theme }) => theme.colors.green[500]};
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
  padding: 2.5rem;
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  -webkit-backdrop-filter: blur(${({ theme }) => theme.glass.blur});
  border-radius: ${({ theme }) => theme.radii.xl};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex-direction: column;
    text-align: center;
    padding: 2rem 1.5rem;
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
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.glass.border};
  color: ${({ theme }) => theme.colors.text[220]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  white-space: nowrap;

  svg {
    color: ${({ theme }) => theme.colors.green[500]};
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
