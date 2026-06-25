import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { FiZap, FiX, FiArrowLeft, FiCompass } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import styled from 'styled-components'
import api, { invalidateTripsCache } from '../data/api'
import type { User, AiTripPlannerRequest } from '../types/models'
import { LocationAutocompleteField } from '../components/LocationAutocompleteField'
import { ToastContainer } from '../components/shared/Toast'
import { useToast } from '../components/shared/useToast'
import { getErrorMessage } from '../utils/errorMessage'
import { glassMorphism, inputField } from '../styles/mixins'

const revealTransition = {
  duration: 0.55,
  ease: [0.22, 1, 0.36, 1] as const,
}

interface AuthStoreState {
  auth: {
    user: User | null
    token: string | null
  }
}

/* ------------------------------------------------------------------ */
/*  Styled Components                                                  */
/* ------------------------------------------------------------------ */

const PageWrapper = styled.section`
  width: min(800px, 100% - 2rem);
  margin: 0 auto;
  padding-top: 4rem;
  padding-bottom: 2rem;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding-top: calc(env(safe-area-inset-top) + 1.5rem);
  }
`

const BackButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1.2rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  background: transparent;
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  color: ${({ theme }) => theme.colors.text[220]};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 1.5rem;
  margin-left: -1rem;
  min-height: 44px;
  min-width: 44px;
  transition: all 0.2s;

  &:hover {
    background: rgba(143, 179, 106, 0.08);
    border-color: ${({ theme }) => theme.colors.line};
    color: ${({ theme }) => theme.colors.text[100]};
  }
`

const Header = styled(motion.header)`
  margin-bottom: 3rem;
`

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
`

const HeaderIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.8rem;
  border-radius: 16px;
  background: ${({ theme }) => theme.colors.green[580]};
  color: white;
`

const HeaderTitle = styled.h1`
  font-size: ${({ theme }) => theme.typography.h1};
  color: ${({ theme }) => theme.colors.text[100]};
  margin: 0;
`

const HeaderLead = styled.p`
  font-size: ${({ theme }) => theme.typography.lead};
  color: ${({ theme }) => theme.colors.text[380]};
  opacity: 0.7;
  margin: 0;
`

const Form = styled(motion.form)`
  ${glassMorphism()}
  padding: 2.5rem;
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  border-radius: ${({ theme }) => theme.radii.xl};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: 1.5rem;
  }
`

const FormGrid = styled.div`
  display: grid;
  gap: 2rem;
`

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
`

const FieldLabel = styled.label`
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text[220]};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`

const Input = styled.input`
  ${inputField}
`

const Textarea = styled.textarea`
  ${inputField}
  resize: vertical;
  min-height: 120px;
  font-family: inherit;
  font-size: 1.1rem;
  line-height: 1.6;
`

const FieldHint = styled.p`
  font-size: ${({ theme }) => theme.typography.eyebrow};
  color: ${({ theme }) => theme.colors.text[500]};
  margin: 0;
  opacity: 0.5;
`

const BuilderGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
  }
`

const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
`

const Chip = styled.button<{ $selected?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.35rem 0.85rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ $selected, theme }) => ($selected ? theme.colors.green[580] : theme.colors.lineSoft)};
  background: ${({ $selected }) => ($selected ? 'rgba(143, 179, 106, 0.15)' : 'transparent')};
  color: ${({ $selected, theme }) => ($selected ? theme.colors.green[300] : theme.colors.text[380])};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: ${({ $selected }) => ($selected ? 600 : 400)};
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: ${({ theme }) => theme.colors.green[580]};
    background: rgba(143, 179, 106, 0.08);
  }
`

const SubmitButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  width: 100%;
  height: 60px;
  font-size: 1.2rem;
  font-weight: 700;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: none;
  cursor: pointer;
  background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[580]} 0%, ${({ theme }) => theme.colors.green[700]} 100%);
  color: white;
  box-shadow: 0 10px 30px rgba(154, 198, 148, 0.2);
  margin-top: 1rem;
  transition: all 0.3s;

  &:hover:not(:disabled) {
    background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[500]} 0%, ${({ theme }) => theme.colors.green[580]} 100%);
    box-shadow: 0 10px 40px rgba(154, 198, 148, 0.35);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`

const FooterNote = styled.footer`
  margin-top: 4rem;
  text-align: center;
  padding-bottom: 4rem;
  opacity: 0.4;
`

const FooterText = styled.p`
  font-size: ${({ theme }) => theme.typography.eyebrow};
  color: ${({ theme }) => theme.colors.text[500]};
  margin: 0;
`

/* ------------------------------------------------------------------ */
/*  AiTripPlannerPage                                                  */
/* ------------------------------------------------------------------ */

export function AiTripPlannerPage() {
  const navigate = useNavigate()
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const { toasts, addToast, removeToast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)
  const [form, setForm] = useState<AiTripPlannerRequest>({
    description: '',
    durationDays: 3,
    budget: 500,
    startingPoint: '',
    interests: user?.tags || [],
    maxParticipants: user?.groupSize || 4,
  })

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        interests: user.tags || [],
        maxParticipants: user.groupSize || 4,
      }))
    }
  }, [user])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isGenerating) return
    setIsGenerating(true)
    try {
      const { data } = await api.post<{ tripId: number }>('/api/ai/generate-trip', form)
      invalidateTripsCache()
      navigate(`/app/trip/${data.tripId}`)
    } catch (err: unknown) {
      addToast(getErrorMessage(err, 'AI generation failed.'), 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  if (!user) return null

  return (
    <PageWrapper>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <Header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={revealTransition}
      >
        <BackButton onClick={() => navigate(-1)}>
          <FiArrowLeft /> Back to Discovery
        </BackButton>
        <HeaderRow>
          <HeaderIcon>
            <FiZap size={24} />
          </HeaderIcon>
          <HeaderTitle>AI Expedition Planner</HeaderTitle>
        </HeaderRow>
        <HeaderLead>
          Describe your dream journey and let our machine intelligence architect a complete mission plan for you.
        </HeaderLead>
      </Header>

      <Form
        onSubmit={handleGenerate}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...revealTransition, delay: 0.1 }}
      >
        <FormGrid>
          <FormGroup>
            <FieldLabel>The Vision</FieldLabel>
            <Textarea
              rows={4}
              placeholder="Ex: A high-octane adventure through the Dolomites, focusing on technical hiking trails and secluded mountain huts..."
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              required
            />
            <FieldHint>The more detail you provide, the better the plan.</FieldHint>
          </FormGroup>

          <BuilderGrid>
            <FormGroup>
              <FieldLabel>Duration (Days)</FieldLabel>
              <Input type="number" min={1} max={30} value={form.durationDays} onChange={(e) => setForm((p) => ({ ...p, durationDays: Number(e.target.value) }))} />
            </FormGroup>
            <FormGroup>
              <FieldLabel>Budget per Person (EUR)</FieldLabel>
              <Input type="number" min={100} value={form.budget} onChange={(e) => setForm((p) => ({ ...p, budget: Number(e.target.value) }))} />
            </FormGroup>
          </BuilderGrid>

          <BuilderGrid>
            <LocationAutocompleteField
              id="planner-starting-point"
              label="Deployment Base (Starting Point)"
              placeholder="Where does the mission begin?"
              value={form.startingPoint}
              onValueChange={(v) => setForm((p) => ({ ...p, startingPoint: v }))}
              onLocationSelect={(s) => setForm((p) => ({ ...p, startingPoint: s.placeName }))}
            />
            <FormGroup>
              <FieldLabel>Max Team Size</FieldLabel>
              <Input type="number" min={1} value={form.maxParticipants} onChange={(e) => setForm((p) => ({ ...p, maxParticipants: Number(e.target.value) }))} />
            </FormGroup>
          </BuilderGrid>

          <FormGroup>
            <FieldLabel>Interests & Mission Style</FieldLabel>
            <ChipRow>
              {form.interests.map((tag) => (
                <Chip key={tag} type="button" $selected onClick={() => setForm((p) => ({ ...p, interests: p.interests.filter((t) => t !== tag) }))}>
                  {tag} <FiX size={12} style={{ marginLeft: '4px' }} />
                </Chip>
              ))}
            </ChipRow>
            <Input
              placeholder="Add custom interest tag..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const val = (e.target as HTMLInputElement).value.trim().toLowerCase()
                  if (val && !form.interests.includes(val)) {
                    setForm((p) => ({ ...p, interests: [...p.interests, val] }))
                    ;(e.target as HTMLInputElement).value = ''
                  }
                }
              }}
            />
          </FormGroup>

          <SubmitButton type="submit" disabled={isGenerating || !form.description || !form.startingPoint}>
            {isGenerating ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                  <FiCompass aria-hidden />
                </motion.div>
                Architecting Itinerary...
              </>
            ) : (
              <>
                <FiZap /> Generate Mission Plan
              </>
            )}
          </SubmitButton>
        </FormGrid>
      </Form>

      <FooterNote>
        <FooterText>Powered by TripGenius AI Engine v2.0</FooterText>
      </FooterNote>
    </PageWrapper>
  )
}
