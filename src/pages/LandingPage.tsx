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

interface FeatureCard {
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

const featureCards = [
  {
    title: 'Trip management for real groups',
    description:
      'Plan day-by-day routes, assign owner/admin roles, and keep everyone synced before, during, and after each trip.',
    Icon: FiUsers,
  },
  {
    title: 'Discover people with matching interests',
    description:
      'Publish your trip, define group limits, and find travelers who match your pace, budget, and activity preferences.',
    Icon: FiCompass,
  },
  {
    title: 'Offline-first travel flow',
    description:
      'Use TripGenius as a PWA, keep essential trip context available offline, and continue team communication in low-signal areas.',
    Icon: FiWifiOff,
  },
] satisfies FeatureCard[]

const journeySteps: JourneyStep[] = [
  {
    title: 'Define your travel DNA',
    detail:
      'Set onboarding preferences once: trip styles, ideal group size, budget level, and preferred pace.',
  },
  {
    title: 'Launch or join a trip room',
    detail:
      'Create your own itinerary with timeline stops or join existing trips that align with your profile.',
  },
  {
    title: 'Coordinate as a team',
    detail:
      'Chat with your group, split expenses, and update route details with role-based owner/admin controls.',
  },
  {
    title: 'Move with confidence offline',
    detail:
      'Keep context when internet disappears: route checkpoints, planning notes, and key trip details still available.',
  },
]

const metrics = [
  { value: '8+', label: 'Core pages built as standalone routes' },
  { value: '100%', label: 'Mock frontend coverage for your requested flows' },
  { value: 'PWA-ready', label: 'Design prepared for offline expansion' },
]

const highlights = [
  'Smart member matching',
  'Expense and role management',
  'Map-based trip timelines',
  'Works online and offline',
]

export function LandingPage() {
  return (
    <section className="page landing-page">
      <motion.div
        className="panel landing-hero"
        initial="hidden"
        animate="show"
        variants={motionItem}
      >
        <p className="eyebrow">Trip planning that feels alive</p>
        <h1>TripGenius helps you find, manage, and scale group adventures.</h1>

        <div className="landing-lead-stack">
          <p className="lead">
            TripGenius is built for modern group travel: you can organize trips with
            your existing friends, or open your trip publicly and discover people
            with the same interests who want to join.
          </p>
          <p className="lead">
            Beyond simple itinerary storage, you get a collaborative system where
            owners and admins can manage members, update stops, and keep everyone
            aligned around schedule and costs.
          </p>
          <p className="lead">
            If your group needs a few more people, post the trip and expenses
            transparently, and the platform helps you find suitable matches.
            TripGenius also supports offline-first workflows as a PWA, so your
            group can keep context and communication even when connectivity drops.
          </p>
        </div>

        <div className="hero-actions">
          <Link className="btn btn-primary" to="/register">
            Create account
          </Link>
          <Link className="btn btn-ghost" to="/discover">
            Explore discovery feed
          </Link>
        </div>

        <ul className="highlights-list">
          {highlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </motion.div>

      <motion.div
        className="landing-metrics"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={motionItem}
      >
        {metrics.map((metric) => (
          <article key={metric.label} className="panel metric-card">
            <p className="metric-value">{metric.value}</p>
            <p>{metric.label}</p>
          </article>
        ))}
      </motion.div>

      <motion.div
        className="feature-grid"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        variants={motionItem}
      >
        {featureCards.map((feature) => (
          <article className="panel feature-card" key={feature.title}>
            <feature.Icon className="feature-icon" aria-hidden="true" />
            <h2>{feature.title}</h2>
            <p>{feature.description}</p>
          </article>
        ))}
      </motion.div>

      <motion.section
        className="panel landing-story-grid"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.24 }}
        variants={motionItem}
      >
        <div className="story-copy">
          <p className="eyebrow">Why this platform exists</p>
          <h2>Group trips usually fail in the details, not the idea.</h2>
          <p>
            Most groups start with excitement and then lose momentum because plans
            are spread across chats, spreadsheets, and map screenshots. TripGenius
            centralizes that coordination into one interface so decisions become
            visible, actionable, and shared.
          </p>
          <p>
            You can see who is in, who pays what, what route is live today, and
            where the group is headed tomorrow without digging through dozens of
            messages.
          </p>
        </div>

        <ul className="story-list">
          <li>
            <FiMap aria-hidden="true" />
            <div>
              <h3>Route clarity</h3>
              <p>Timeline stops translate directly into interactive route context.</p>
            </div>
          </li>
          <li>
            <FiCreditCard aria-hidden="true" />
            <div>
              <h3>Cost transparency</h3>
              <p>Shared expenses stay visible so trust and planning speed increase.</p>
            </div>
          </li>
          <li>
            <FiMessageCircle aria-hidden="true" />
            <div>
              <h3>Communication in one place</h3>
              <p>Trip chat and timeline updates live together with your member list.</p>
            </div>
          </li>
          <li>
            <FiShield aria-hidden="true" />
            <div>
              <h3>Role-based control</h3>
              <p>Owners and admins can actively manage group quality and safety.</p>
            </div>
          </li>
        </ul>
      </motion.section>

      <motion.section
        className="panel journey-grid"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.24 }}
        variants={motionItem}
      >
        <p className="eyebrow">How it works</p>
        <h2>From idea to departure in four clear steps</h2>

        <div className="journey-cards">
          {journeySteps.map((step, index) => (
            <article key={step.title} className="journey-step">
              <span className="step-index">0{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
      </motion.section>

      <motion.section
        className="panel landing-cta"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.24 }}
        variants={motionItem}
      >
        <h2>Ready to travel with smarter coordination?</h2>
        <p>
          Start by creating your onboarding profile, then jump into discovery to
          find matching trips or create your own group space.
        </p>
        <div className="cta-actions">
          <Link className="btn btn-primary" to="/register">
            Start onboarding
          </Link>
          <Link className="btn btn-ghost" to="/discover">
            Browse trips now
          </Link>
        </div>
      </motion.section>
    </section>
  )
}
