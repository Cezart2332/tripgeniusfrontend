import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { FiMessageSquare, FiSend } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { aiKnowledgeTrips, mockTrips, mockUserProfile } from '../data/mockData'

interface RankedRecommendation {
  id: string
  title: string
  destination: string
  summary: string
  score: number
  reason: string
}

interface AiChatMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
  recommendations?: RankedRecommendation[]
  externalIdeas?: string[]
}

const calculateReason = (
  matchingPromptTerms: string[],
  matchingProfileTags: string[],
): string => {
  if (matchingPromptTerms.length > 0 && matchingProfileTags.length > 0) {
    return `Matches your prompt (${matchingPromptTerms.join(', ')}) and profile preferences (${matchingProfileTags.join(', ')}).`
  }

  if (matchingPromptTerms.length > 0) {
    return `Strong match for your prompt keywords: ${matchingPromptTerms.join(', ')}.`
  }

  if (matchingProfileTags.length > 0) {
    return `Aligned with your onboarding interests: ${matchingProfileTags.join(', ')}.`
  }

  return 'Good balanced option based on trip activity and group size.'
}

export function AiAdvisorPage() {
  const [prompt, setPrompt] = useState('')
  const [preferProfile, setPreferProfile] = useState(true)
  const [isTyping, setIsTyping] = useState(false)
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content:
        'Hi! I am your TripGenius AI advisor. Tell me your ideal destination, vibe, budget, and group style, and I will recommend the best matching trips.',
    },
  ])

  const threadRef = useRef<HTMLDivElement | null>(null)

  const quickPrompts = useMemo(
    () => [
      'I want a mountain roadtrip with medium budget and a small group.',
      'Find me a relaxing nature retreat for 5-7 people under 900 EUR.',
      'Suggest a high-energy city trip with food and nightlife vibes.',
    ],
    [],
  )

  useEffect(() => {
    if (!threadRef.current) {
      return
    }

    threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [messages, isTyping])

  const rankRecommendations = (
    submittedPrompt: string,
    useProfileBoost: boolean,
  ): RankedRecommendation[] => {
    const promptTerms = submittedPrompt
      .toLowerCase()
      .split(/[^a-z-]+/)
      .filter((token) => token.length > 2)

    return [...mockTrips]
      .map((trip) => {
        const lowerTitle = `${trip.title} ${trip.description} ${trip.destination}`.toLowerCase()

        const matchingPromptTerms = trip.tags.filter(
          (tag) => promptTerms.includes(tag) || lowerTitle.includes(tag),
        )

        const matchingProfileTags = trip.tags.filter((tag) =>
          mockUserProfile.preferences.tripTypes.includes(tag),
        )

        let score = matchingPromptTerms.length * 3

        if (useProfileBoost) {
          score += matchingProfileTags.length * 2
        }

        if (trip.maxMembers <= mockUserProfile.preferences.maxGroupSize) {
          score += 2
        }

        if (trip.status === 'upcoming') {
          score += 1
        }

        return {
          id: trip.id,
          title: trip.title,
          destination: trip.destination,
          summary: trip.description,
          score,
          reason: calculateReason(matchingPromptTerms, matchingProfileTags),
        }
      })
      .sort((first, second) => second.score - first.score)
      .slice(0, 3)
  }

  const selectExternalIdeas = (submittedPrompt: string): string[] => {
    const promptTerms = submittedPrompt
      .toLowerCase()
      .split(/[^a-z-]+/)
      .filter((token) => token.length > 2)

    const matchingIdeas = aiKnowledgeTrips
      .filter((idea) =>
        idea.matchingTags.some(
          (tag) => promptTerms.includes(tag) || submittedPrompt.toLowerCase().includes(tag),
        ),
      )
      .slice(0, 2)
      .map((idea) => idea.title)

    if (matchingIdeas.length > 0) {
      return matchingIdeas
    }

    return aiKnowledgeTrips.slice(0, 2).map((idea) => idea.title)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt) {
      return
    }

    const userMessage: AiChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedPrompt,
    }

    setMessages((previous) => [...previous, userMessage])
    setPrompt('')
    setIsTyping(true)

    const recommendations = rankRecommendations(trimmedPrompt, preferProfile)
    const externalIdeas = selectExternalIdeas(trimmedPrompt)

    const assistantMessage: AiChatMessage = {
      id: `assistant-${Date.now() + 1}`,
      role: 'assistant',
      content:
        recommendations.length > 0
          ? `Great brief. I found ${recommendations.length} strong options based on your request.`
          : 'I did not find a perfect match, but here are the closest options you can explore.',
      recommendations,
      externalIdeas,
    }

    window.setTimeout(() => {
      setMessages((previous) => [...previous, assistantMessage])
      setIsTyping(false)
    }, 420)
  }

  return (
    <section className="page ai-page">
      <header className="panel ai-header">
        <p className="eyebrow">AI expedition advisor</p>
        <h1>Plan by conversation, execute by structure.</h1>
        <p>
          Ask naturally, get ranked trip options, then jump directly into a workspace.
        </p>
      </header>

      <div className="ai-workspace-shell">
        <aside className="panel ai-brief-rail">
          <h2>Prompt shortcuts</h2>
          <div className="ai-quick-prompts">
            {quickPrompts.map((quickPrompt) => (
              <button
                key={quickPrompt}
                type="button"
                className="chip"
                onClick={() => setPrompt(quickPrompt)}
              >
                {quickPrompt}
              </button>
            ))}
          </div>

          <label className="toggle">
            <input
              type="checkbox"
              checked={preferProfile}
              onChange={(event) => setPreferProfile(event.target.checked)}
            />
            Boost with onboarding preferences
          </label>

          <Link className="btn btn-ghost" to="/discover">
            Open discovery feed
          </Link>
        </aside>

        <section className="panel ai-chat-shell">
          <div className="ai-thread" ref={threadRef}>
            {messages.map((message) => (
              <article
                key={message.id}
                className={
                  message.role === 'assistant' ? 'ai-bubble assistant' : 'ai-bubble user'
                }
              >
                <p className="ai-bubble-meta">
                  {message.role === 'assistant' ? 'TripGenius AI' : 'You'}
                </p>
                <p>{message.content}</p>

                {message.recommendations ? (
                  <div className="ai-suggestion-list">
                    {message.recommendations.map((recommendation) => (
                      <div key={recommendation.id} className="ai-suggestion-card">
                        <p className="list-title">
                          {recommendation.title} - Score {recommendation.score}
                        </p>
                        <p>{recommendation.destination}</p>
                        <p>{recommendation.summary}</p>
                        <p>{recommendation.reason}</p>
                        <Link className="btn btn-primary" to={`/trip/${recommendation.id}`}>
                          Open trip
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : null}

                {message.externalIdeas ? (
                  <div className="match-reasons">
                    {message.externalIdeas.map((idea) => (
                      <span key={idea} className="reason-chip">
                        External idea: {idea}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}

            {isTyping ? (
              <div className="ai-typing">
                <FiMessageSquare aria-hidden="true" />
                AI is thinking...
              </div>
            ) : null}
          </div>

          <form className="ai-composer" onSubmit={handleSubmit}>
            <div className="ai-composer-row">
              <input
                className="input"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ask for the kind of trip you want..."
              />
              <button className="btn btn-primary" type="submit">
                <FiSend aria-hidden="true" />
                Send
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
  )
}
