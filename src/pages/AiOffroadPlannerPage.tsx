import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { FiZap, FiX, FiArrowLeft } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import api, { invalidateTripsCache } from '../data/api'
import type { User, AiOffroadPlannerRequest } from '../types/models'
import { LocationAutocompleteField } from '../components/LocationAutocompleteField'
import { FeedbackToast } from '../components/FeedbackToast'
import type { FeedbackToastState } from '../components/FeedbackToast'
import { getErrorMessage } from '../utils/errorMessage'
import { DiscoveryModeTabs } from './OffroadDiscoveryPage'

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

const difficultyLevels = ['Easy', 'Moderate', 'Hard', 'Expert'] as const

export function AiOffroadPlannerPage() {
  const navigate = useNavigate()
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const [toast, setToast] = useState<FeedbackToastState | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [form, setForm] = useState<AiOffroadPlannerRequest>({
    description: '',
    durationDays: 3,
    budget: 500,
    region: '',
    interests: user?.tags || [],
    maxParticipants: user?.groupSize || 4,
    difficultyLevel: 'Moderate'
  })

  useEffect(() => {
    if (user) {
      setForm(prev => ({
        ...prev,
        interests: user.tags || [],
        maxParticipants: user.groupSize || 4
      }))
    }
  }, [user])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isGenerating) return
    setIsGenerating(true)
    try {
      const { data } = await api.post<{ tripId: number }>('/api/ai/generate-offroad-trip', form)
      invalidateTripsCache()
      navigate(`/app/offroad/${data.tripId}`)
    } catch (err: unknown) {
      setToast({ id: Date.now(), message: getErrorMessage(err, 'Offroad AI generation failed.'), tone: 'error' })
    } finally {
      setIsGenerating(false)
    }
  }

  if (!user) return null

  return (
    <section className="page discovery-page-offroad ai-offroad-planner-page" style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '2rem' }}>
      <DiscoveryModeTabs />
      <FeedbackToast toast={toast} clearToast={() => setToast(null)} />

      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={revealTransition}
        style={{ marginBottom: '3rem' }}
      >
        <button onClick={() => navigate('/app/offroad')} className="btn btn-ghost btn-sm" style={{ marginBottom: '1.5rem', marginLeft: '-1rem' }}>
          <FiArrowLeft /> Back to Offroad
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ background: 'var(--offroad-accent, #c9a227)', padding: '0.8rem', borderRadius: '16px', color: '#1a1408' }}>
            <FiZap size={24} />
          </div>
          <h1>AI Trail Architect</h1>
        </div>
        <p className="lead" style={{ opacity: 0.7 }}>
          Describe the hiking or trail adventure you want and let AI plan real GPS foot routes, waypoints, and daily trail segments for you.
        </p>
      </motion.header>

      <motion.form
        onSubmit={handleGenerate}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...revealTransition, delay: 0.1 }}
        className="builder-section-v2"
        style={{ padding: '2.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--offroad-line, var(--line-soft))' }}
      >
        <div style={{ display: 'grid', gap: '2rem' }}>
          <div className="form-group">
            <label className="field-label">The Mission</label>
            <textarea
              className="input"
              rows={4}
              style={{ fontSize: '1.1rem', lineHeight: 1.6 }}
              placeholder="Ex: A 3-day hiking adventure through the Carpathian mountains, focusing on mountain trails and passes with scenic viewpoints..."
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              required
            />
            <p className="eyebrow" style={{ marginTop: '0.5rem', fontSize: '0.75rem', opacity: 0.5 }}>Describe terrain type, scenery, trail style, and daily objectives. Each day&apos;s route is capped at 20 km.</p>
          </div>

          <div className="builder-grid-v2">
            <div className="form-group">
              <label className="field-label">Duration (Days)</label>
              <input type="number" className="input" min={1} max={14} value={form.durationDays} onChange={e => setForm(p => ({ ...p, durationDays: Number(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label className="field-label">Budget per Person (EUR)</label>
              <input type="number" className="input" min={50} value={form.budget} onChange={e => setForm(p => ({ ...p, budget: Number(e.target.value) }))} />
            </div>
          </div>

          <div className="builder-grid-v2">
            <LocationAutocompleteField
              id="offroad-planner-region"
              label="Region / Area"
              placeholder="Carpathian Mountains, Transylvania..."
              value={form.region}
              onValueChange={v => setForm(p => ({ ...p, region: v }))}
              onLocationSelect={s => setForm(p => ({ ...p, region: s.placeName }))}
            />
            <div className="form-group">
              <label className="field-label">Max Team Size</label>
              <input type="number" className="input" min={1} value={form.maxParticipants} onChange={e => setForm(p => ({ ...p, maxParticipants: Number(e.target.value) }))} />
            </div>
          </div>

          <div className="form-group">
            <label className="field-label">Difficulty Level</label>
            <div className="chip-row" style={{ marginTop: '0.5rem' }}>
              {difficultyLevels.map(level => (
                <button
                  key={level}
                  type="button"
                  className={`chip ${form.difficultyLevel === level ? 'is-selected' : ''}`}
                  onClick={() => setForm(p => ({ ...p, difficultyLevel: level }))}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="eyebrow" style={{ marginTop: '0.5rem', fontSize: '0.75rem', opacity: 0.5 }}>
              {form.difficultyLevel === 'Easy' && 'Well-marked flat or gently undulating paths, suitable for all fitness levels.'}
              {form.difficultyLevel === 'Moderate' && 'Some elevation gain and uneven terrain, suitable for regular walkers.'}
              {form.difficultyLevel === 'Hard' && 'Significant ascent/descent, rocky sections — good fitness and footwear required.'}
              {form.difficultyLevel === 'Expert' && 'Demanding mountain routes, exposed ridges, scrambling — experienced trekkers only.'}
            </p>
          </div>

          <div className="form-group">
            <label className="field-label">Interests & Trail Style</label>
            <div className="chip-row" style={{ marginBottom: '1rem' }}>
              {form.interests.map(tag => (
                <button key={tag} type="button" className="chip is-selected" onClick={() => setForm(p => ({ ...p, interests: p.interests.filter(t => t !== tag) }))}>
                  {tag} <FiX size={12} style={{ marginLeft: '4px' }} />
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                className="input"
                placeholder="Add custom interest tag..."
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const val = (e.target as HTMLInputElement).value.trim().toLowerCase()
                    if (val && !form.interests.includes(val)) {
                      setForm(p => ({ ...p, interests: [...p.interests, val] }))
                        ; (e.target as HTMLInputElement).value = ''
                    }
                  }
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <button
              type="submit"
              className="btn btn-primary btn-lg offroad-btn-primary"
              style={{ width: '100%', height: '60px', fontSize: '1.2rem', background: 'linear-gradient(135deg, var(--offroad-accent, #c9a227) 0%, #8b7316 100%)', boxShadow: '0 10px 30px rgba(201,162,39,0.15)', color: '#1a1408' }}
              disabled={isGenerating || !form.description || !form.region}
            >
              {isGenerating ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', justifyContent: 'center' }}>
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><FiZap /></motion.div>
                  Planning your trail...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', justifyContent: 'center' }}>
                  <FiZap /> Generate Offroad Mission
                </span>
              )}
            </button>
          </div>
        </div>
      </motion.form>

      <footer style={{ marginTop: '4rem', textAlign: 'center', paddingBottom: '4rem', opacity: 0.4 }}>
        <p className="eyebrow" style={{ fontSize: '0.7rem' }}>Powered by TripGenius AI Trail Engine</p>
      </footer>
    </section>
  )
}
