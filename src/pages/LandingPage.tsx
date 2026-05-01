import { motion } from 'framer-motion'
import { useState } from 'react'
import type { MouseEvent } from 'react'
import {
  FiArrowRight,
  FiCompass,
  FiMap,
  FiMessageCircle,
  FiUsers,
  FiWifiOff,
} from 'react-icons/fi'
import type { IconType } from 'react-icons'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { FeedbackToast } from '../components/FeedbackToast'
import type { FeedbackToastState, FeedbackToastTone } from '../components/FeedbackToast'
import type { User } from '../types/models'

interface AuthStoreState {
  auth: {
    user: User | null
    token: string | null
  }
}

const ALREADY_LOGGED_IN_MESSAGE = 'No need to create a new account, you are already logged in'

interface FeatureItem {
  title: string
  description: string
  Icon: IconType
}

const motionItem = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
}

const staggerContainer = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const featureItems: FeatureItem[] = [
  {
    title: 'Group operations',
    description: 'Manage routes, roles, and logistics in one place.',
    Icon: FiUsers,
  },
  {
    title: 'Smart discovery',
    description: 'Find travelers whose style matches your plan.',
    Icon: FiCompass,
  },
  {
    title: 'Offline ready',
    description: 'Keep trip context available without a connection.',
    Icon: FiWifiOff,
  },
]

const steps = [
  { num: '01', title: 'Define your travel DNA', sub: 'Set preferred styles and ideal group size.' },
  { num: '02', title: 'Launch or join a trip', sub: 'Create an itinerary or enter a workspace.' },
  { num: '03', title: 'Coordinate together', sub: 'Map, timeline, members, and chat as one.' },
]

export function LandingPage() {
  const navigate = useNavigate()
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const [toast, setToast] = useState<FeedbackToastState | null>(null)

  const showToast = (message: string, tone: FeedbackToastTone) => {
    setToast({
      id: Date.now(),
      message,
      tone,
    })
  }

  const handleCreateAccountClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!user) {
      return
    }

    event.preventDefault()
    showToast(ALREADY_LOGGED_IN_MESSAGE, 'info')
  }

  const handleGetStartedClick = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (!user) {
      return
    }

    event.preventDefault()
    navigate('/profile')
  }

  return (
    <section className="page landing-page-v2">
      <FeedbackToast toast={toast} clearToast={() => setToast(null)} />

      {/* ── HERO ── */}
      <motion.header
        className="landing-hero-v2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <div className="landing-hero-text">
          <p className="eyebrow">TripGenius</p>
          <h1>
            Plan trips like an<br />
            <span className="text-accent">expedition crew.</span>
          </h1>
          <p className="lead">
            Centralize route planning, member coordination, and travel ops —
            your group moves from idea to departure without scattered tools.
          </p>
          <div className="landing-hero-actions">
            <Link
              className="btn btn-primary btn-lg"
              to="/register"
              onClick={handleGetStartedClick}
            >
              Get started
              <FiArrowRight aria-hidden="true" />
            </Link>
            <Link className="btn btn-ghost" to="/discover">
              Explore trips
            </Link>
          </div>
        </div>
        <div className="landing-hero-illustration" aria-hidden="true">
          <img
            src="/newstickers/sticker1.png"
            alt=""
            className="landing-hero-sticker"
          />
        </div>
      </motion.header>

      {/* ── FEATURES ── */}
      <motion.section
        className="landing-features-v2"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        variants={staggerContainer}
      >
        {featureItems.map((feature) => (
          <motion.article
            key={feature.title}
            className="landing-feature-item"
            variants={motionItem}
          >
            <span className="landing-feature-icon">
              <feature.Icon aria-hidden="true" />
            </span>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </motion.article>
        ))}
      </motion.section>

      {/* ── HOW IT WORKS ── */}
      <motion.section
        className="landing-steps-v2"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={staggerContainer}
      >
        <div className="landing-steps-header">
          <h2>How it works</h2>
          <p className="lead">Three steps to your next adventure.</p>
        </div>
        <div className="landing-steps-list">
          {steps.map((step) => (
            <motion.div
              key={step.num}
              className="landing-step"
              variants={motionItem}
            >
              <span className="landing-step-num">{step.num}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── CTA ── */}
      <motion.section
        className="landing-cta-v2"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="landing-cta-content">
          <h2>Ready to coordinate?</h2>
          <p>
            Start with your profile, discover trips, or launch your own route room.
          </p>
          <div className="landing-hero-actions">
            <Link className="btn btn-primary" to="/register" onClick={handleCreateAccountClick}>
              Create account
            </Link>
            <Link className="btn btn-ghost" to="/discover">
              Browse trips
            </Link>
          </div>
        </div>
        <div className="landing-cta-aside" aria-hidden="true">
          <div className="landing-cta-cards">
            <div className="landing-mini-card">
              <FiMap aria-hidden="true" />
              <span>Route clarity</span>
            </div>
            <div className="landing-mini-card">
              <FiMessageCircle aria-hidden="true" />
              <span>Live chat</span>
            </div>
            <div className="landing-mini-card">
              <FiUsers aria-hidden="true" />
              <span>Role controls</span>
            </div>
          </div>
        </div>
      </motion.section>
    </section>
  )
}
