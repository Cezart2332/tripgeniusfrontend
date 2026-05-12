import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { FiZap, FiX, FiArrowLeft } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import api, { invalidateTripsCache } from '../data/api'
import type { User, AiTripPlannerRequest } from '../types/models'
import { LocationAutocompleteField } from '../components/LocationAutocompleteField'
import { FeedbackToast } from '../components/FeedbackToast'
import type { FeedbackToastState } from '../components/FeedbackToast'

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

export function AiTripPlannerPage() {
  const navigate = useNavigate()
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const [toast, setToast] = useState<FeedbackToastState | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [form, setForm] = useState<AiTripPlannerRequest>({
    description: '',
    durationDays: 3,
    budget: 500,
    startingPoint: '',
    interests: user?.tags || [],
    maxParticipants: user?.groupSize || 4
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
      console.log(form)
      await api.post('/api/ai/generate-trip', form)
      setToast({ id: Date.now(), message: 'Trip generated successfully!', tone: 'success' })
      invalidateTripsCache()
      setTimeout(() => navigate('/app/discover'), 2000)
    } catch (err: any) {
      setToast({ id: Date.now(), message: err.response?.data?.message || 'AI generation failed.', tone: 'error' })
    } finally {
      setIsGenerating(false)
    }
  }

  if (!user) return null

  return (
    <section className="page ai-planner-page container" style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '4rem' }}>
      <FeedbackToast toast={toast} clearToast={() => setToast(null)} />

      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={revealTransition}
        style={{ marginBottom: '3rem' }}
      >
        <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm" style={{ marginBottom: '1.5rem', marginLeft: '-1rem' }}>
          <FiArrowLeft /> Back to Discovery
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ background: 'var(--green-580)', padding: '0.8rem', borderRadius: '16px', color: 'white' }}>
            <FiZap size={24} />
          </div>
          <h1>AI Expedition Planner</h1>
        </div>
        <p className="lead" style={{ opacity: 0.7 }}>
          Describe your dream journey and let our machine intelligence architect a complete mission plan for you.
        </p>
      </motion.header>

      <motion.form
        onSubmit={handleGenerate}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...revealTransition, delay: 0.1 }}
        className="builder-section-v2"
        style={{ padding: '2.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--line-soft)' }}
      >
        <div style={{ display: 'grid', gap: '2rem' }}>
          <div className="form-group">
            <label className="field-label">The Vision</label>
            <textarea
              className="input"
              rows={4}
              style={{ fontSize: '1.1rem', lineHeight: 1.6 }}
              placeholder="Ex: A high-octane adventure through the Dolomites, focusing on technical hiking trails and secluded mountain huts..."
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              required
            />
            <p className="eyebrow" style={{ marginTop: '0.5rem', fontSize: '0.75rem', opacity: 0.5 }}>The more detail you provide, the better the plan.</p>
          </div>

          <div className="builder-grid-v2">
            <div className="form-group">
              <label className="field-label">Duration (Days)</label>
              <input type="number" className="input" min={1} max={30} value={form.durationDays} onChange={e => setForm(p => ({ ...p, durationDays: Number(e.target.value) }))} />
            </div>
            <div className="form-group">
              <label className="field-label">Budget per Person (EUR)</label>
              <input type="number" className="input" min={100} value={form.budget} onChange={e => setForm(p => ({ ...p, budget: Number(e.target.value) }))} />
            </div>
          </div>

          <div className="builder-grid-v2">
            <LocationAutocompleteField
              id="planner-starting-point"
              label="Deployment Base (Starting Point)"
              placeholder="Where does the mission begin?"
              value={form.startingPoint}
              onValueChange={v => setForm(p => ({ ...p, startingPoint: v }))}
              onLocationSelect={s => setForm(p => ({ ...p, startingPoint: s.placeName }))}
            />
            <div className="form-group">
              <label className="field-label">Max Team Size</label>
              <input type="number" className="input" min={1} value={form.maxParticipants} onChange={e => setForm(p => ({ ...p, maxParticipants: Number(e.target.value) }))} />
            </div>
          </div>

          <div className="form-group">
            <label className="field-label">Interests & Mission Style</label>
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
              className="btn btn-primary btn-lg"
              style={{ width: '100%', height: '60px', fontSize: '1.2rem', background: 'linear-gradient(135deg, var(--green-580) 0%, var(--green-700) 100%)', boxShadow: '0 10px 30px rgba(154,198,148,0.2)' }}
              disabled={isGenerating || !form.description || !form.startingPoint}
            >
              {isGenerating ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', justifyContent: 'center' }}>
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><FiZap /></motion.div>
                  Architecting Itinerary...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', justifyContent: 'center' }}>
                  <FiZap /> Generate Mission Plan
                </span>
              )}
            </button>
          </div>
        </div>
      </motion.form>

      <footer style={{ marginTop: '4rem', textAlign: 'center', paddingBottom: '4rem', opacity: 0.4 }}>
        <p className="eyebrow" style={{ fontSize: '0.7rem' }}>Powered by TripGenius AI Engine v2.0</p>
      </footer>
    </section>
  )
}
