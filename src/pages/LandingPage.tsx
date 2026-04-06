import { motion } from 'framer-motion'
import {
  FiCompass,
  FiCreditCard,
  FiMap,
  FiMessageCircle,
  FiShield,
  FiUsers,
  FiWifiOff,
} from 'react-icons/fi'
import type { IconType } from 'react-icons'
import { Link } from 'react-router-dom'

interface FeatureItem {
  title: string
  description: string
  Icon: IconType
}

interface JourneyStep {
  title: string
  detail: string
}

const motionItem = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.52,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
}

const featureItems: FeatureItem[] = [
  {
    title: 'Real group operations',
    description:
      'Manage route days, roles, and trip logistics in one operational flow.',
    Icon: FiUsers,
  },
  {
    title: 'Member discovery by fit',
    description:
      'Open your trip and attract travelers whose style matches your plan.',
    Icon: FiCompass,
  },
  {
    title: 'Offline travel continuity',
    description:
      'Keep essential trip context available while network quality changes.',
    Icon: FiWifiOff,
  },
]

const journeySteps: JourneyStep[] = [
  {
    title: 'Define your travel DNA',
    detail: 'Set preferred trip styles and ideal group size once.',
  },
  {
    title: 'Launch or join a trip room',
    detail: 'Create your itinerary or enter an existing trip workspace.',
  },
  {
    title: 'Coordinate execution',
    detail: 'Use map, timeline, member controls, and chat as one system.',
  },
  {
    title: 'Travel with context',
    detail: 'Keep continuity even when the connection gets unreliable.',
  },
]

const highlights = [
  'Member matching',
  'Route timeline control',
  'Role-based collaboration',
  'Offline-first direction',
]

export function LandingPage() {
  return (
    <section className="page landing-page">
      <header className="panel landing-headline" id="mission">
        <p className="eyebrow">Mission</p>
        <h1>Trip planning built like an expedition control room.</h1>
        <p className="lead">
          TripGenius centralizes route planning, member coordination, and travel operations
          so your group can move from idea to departure without scattered tools.
        </p>

        <div className="hero-actions">
          <Link className="btn btn-primary" to="/register">
            Start onboarding
          </Link>
          <Link className="btn btn-ghost" to="/discover">
            Explore discovery feed
          </Link>
        </div>
      </header>

      <nav className="landing-section-nav" aria-label="Landing sections">
        <a href="#mission" className="landing-section-link">
          Mission
        </a>
        <a href="#capabilities" className="landing-section-link">
          Capabilities
        </a>
        <a href="#journey" className="landing-section-link">
          Journey
        </a>
        <a href="#cta" className="landing-section-link">
          Get started
        </a>
      </nav>

      <motion.section
        className="panel landing-ridge"
        id="capabilities"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={motionItem}
      >
        <h2>Core capabilities</h2>
        <div className="landing-flow-grid">
          {featureItems.map((feature) => (
            <article key={feature.title} className="feature-line-item">
              <feature.Icon className="feature-icon" aria-hidden="true" />
              <div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            </article>
          ))}
        </div>
      </motion.section>

      <motion.section
        className="panel landing-ridge"
        id="journey"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={motionItem}
      >
        <h2>How your expedition moves</h2>
        <div className="journey-river">
          {journeySteps.map((step, index) => (
            <article className="journey-step" key={step.title}>
              <span className="step-index">0{index + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.detail}</p>
              </div>
            </article>
          ))}
        </div>

        <ul className="highlights-list">
          {highlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </motion.section>

      <motion.section
        className="panel landing-ridge"
        id="cta"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={motionItem}
      >
        <h2>Everything you need is already mapped.</h2>
        <p>
          Start with your profile, discover suitable trips, or launch your own route room.
        </p>

        <div className="cta-actions">
          <Link className="btn btn-primary" to="/register">
            Create account
          </Link>
          <Link className="btn btn-ghost" to="/discover">
            Browse active trips
          </Link>
        </div>

        <ul className="story-list">
          <li>
            <FiMap aria-hidden="true" />
            <div>
              <h3>Route clarity</h3>
              <p>Timeline stops map directly to visible travel segments.</p>
            </div>
          </li>
          <li>
            <FiCreditCard aria-hidden="true" />
            <div>
              <h3>Cost visibility</h3>
              <p>Group expenses are explicit and easier to align on.</p>
            </div>
          </li>
          <li>
            <FiMessageCircle aria-hidden="true" />
            <div>
              <h3>Live communication</h3>
              <p>Chat and route operations live in the same workspace.</p>
            </div>
          </li>
          <li>
            <FiShield aria-hidden="true" />
            <div>
              <h3>Role controls</h3>
              <p>Owners and admins keep quality and safety standards high.</p>
            </div>
          </li>
        </ul>
      </motion.section>
    </section>
  )
}
