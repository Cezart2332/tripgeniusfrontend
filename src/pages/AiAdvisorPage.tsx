import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { FiSend, FiMapPin, FiExternalLink, FiMessageCircle } from 'react-icons/fi'
import { useSelector, useDispatch } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { setToken } from '../data/authSlice'
import * as signalR from '@microsoft/signalr'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import api from '../data/api'

interface AuthStoreState {
  auth: {
    user: User | null
    token: string | null
  }
}
import { getAvatarUrl } from '../utils/userUtils'
import type { User } from '../types/models'

interface TripCard {
  title: string
  id: number
}

interface ParsedMessage {
  text: string
  trips: TripCard[]
}

function parseAiMessage(raw: string): ParsedMessage {
  // Găsește tot ce e între [TRIPS: și ultimul ]
  const tripMatch = raw.match(/\[TRIPS:(.*?)\]+\s*$/)

  const partialTagIndex = raw.indexOf('[TRIPS:')
  if (partialTagIndex !== -1 && !tripMatch) {
    return { text: raw.slice(0, partialTagIndex).trim(), trips: [] }
  }

  if (!tripMatch) return { text: raw, trips: [] }

  try {
    // Curăță acolade/brackets în plus înainte să parsezi
    let jsonStr = tripMatch[1].trim().replace(/}+\]$/, '}]').replace(/\}+$/, '}')
    const parsed = JSON.parse(jsonStr)
    const text = raw.replace(/\[TRIPS:.*$/s, '').trim()
    return { text, trips: parsed.trips || [] }
  } catch {
    const text = raw.replace(/\[TRIPS:.*$/s, '').trim()
    return { text, trips: [] }
  }
}

interface Message {
  id: string,
  text: string;
  sender: 'user' | 'assistant';
  isComplete?: boolean;
}

interface AiChatResponse {
  message: string;
  role: string;
}

const Typewriter = ({ text, isStreaming }: { text: string; isStreaming?: boolean }) => {
  const [displayedText, setDisplayedText] = useState(text);

  useEffect(() => {
    if (!isStreaming) {
      return;
    }

    if (text.length > displayedText.length) {
      const timeout = setTimeout(() => {
        const diff = text.length - displayedText.length;
        // Faster steps for a snappier feel
        const step = diff > 50 ? 15 : (diff > 20 ? 8 : 1);
        setDisplayedText(text.slice(0, displayedText.length + step));
      }, 25);
      return () => clearTimeout(timeout);
    }
  }, [text, displayedText, isStreaming]);

  return (
    <div className="message-content" style={{ position: 'relative' }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{isStreaming ? displayedText : text}</ReactMarkdown>
      {isStreaming && displayedText.length < text.length && (
        <span className="typing-cursor" style={{ display: 'inline-block', height: '1em', width: '2px', background: 'var(--green-500)', marginLeft: '4px' }}></span>
      )}
    </div>
  );
};


export function AiAdvisorPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const token = useSelector((state: AuthStoreState) => state.auth.token)
  const user = useSelector((state: AuthStoreState) => state.auth.user)
  const [prompt, setPrompt] = useState('')
  const baseURL = import.meta.env.VITE_BASE_URL;
  const [preferProfile, setPreferProfile] = useState(true)
  const [isTyping, setIsTyping] = useState(false)
  const [activeAiMessageId, setActiveAiMessageId] = useState<string | null>(null)
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const aiMessageIdRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([])
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOffline) {
    return <OfflineAiState />
  }

  const threadRef = useRef<HTMLDivElement | null>(null)

  const fetchChatHistory = async () => {
    try {
      const res = await api.get<AiChatResponse[]>('/api/ai/history')
      const historyMessages: Message[] = res.data.map((item) => ({
        id: crypto.randomUUID(),
        text: item.message,
        sender: item.role.toLowerCase() === 'user' ? 'user' : 'assistant',
        isComplete: true
      }))
      setMessages(historyMessages)
    }
    catch (error) {
      console.error(error)
    }
  }



  useEffect(() => {
    if (!threadRef.current) {
      return
    }
    const refreshToken = async () => {
      if (!navigator.onLine) return; // Don't try to refresh if offline
      try {
        const res = await api.post('/api/auth/refresh');
        dispatch(setToken({ token: res.data.token }))
      } catch {
        navigate('/login', { replace: true })
      }
    }
    if (!token) {
      refreshToken()
    }


    threadRef.current.scrollTop = threadRef.current.scrollHeight

    const connection = new signalR.HubConnectionBuilder().withUrl(`${baseURL}/hubs/ai-chat?access_token=${token}`).withAutomaticReconnect([1000, 2000, 5000, 10000, 30000]).build()

    connection.on("StartAiMessage", () => {
      const id = crypto.randomUUID()
      setMessages((prev) => [...prev, { id, text: "", sender: 'assistant', isComplete: false }])
      aiMessageIdRef.current = id;
      setActiveAiMessageId(id)
      setIsTyping(false); // Hide the dots bubble once the real bubble appears
    })

    connection.on("ReceiveAiChunk", (chunk: string) => {
      const id = aiMessageIdRef.current
      setMessages(prev => {
        const index = prev.findIndex(m => m.id === id);
        if (index === -1) return prev;

        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          text: updated[index].text + chunk
        };
        return updated;
      })
    })

    connection.on("EndAiMessage", () => {
      const id = aiMessageIdRef.current;
      setMessages(prev => {
        const index = prev.findIndex(m => m.id === id);
        if (index === -1) return prev;
        const updated = [...prev];
        updated[index] = { ...updated[index], isComplete: true };
        return updated;
      });
      aiMessageIdRef.current = null;
      setActiveAiMessageId(null)
      setIsTyping(false);
    });

    connectionRef.current = connection

    const start = async () => {
      try {
        await connection.start()
        await connection.invoke("JoinAiChat")
      }
      catch (error) {
        console.error(error)
      }
    }
    start()
    return () => {
      const stop = async () => {
        try {
          await connection.invoke("LeaveAiChat")

        }
        catch (error) {
          console.log(error)
        }
        await connection.stop()
      }
      stop()
    }


  }, [token, baseURL, dispatch])

  useEffect(() => {
    if (!token) {
      return
    }
    const loadHistory = async () => {
      await fetchChatHistory()
    }
    void loadHistory()
  }, [token])


  useEffect(() => {
    const thread = threadRef.current;
    if (thread) {
      // If we're near the bottom, keep scrolling with new content
      const isAtBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 250;
      if (isAtBottom) {
        thread.scrollTop = thread.scrollHeight;
      }
    }
  }, [messages, isTyping, dispatch])




  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!prompt.trim() || isTyping) return;

    const text = prompt;

    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), text, sender: "user", isComplete: true }
    ]);

    setPrompt("");
    setIsTyping(true);

    try {
      await connectionRef.current?.invoke("SendAiMessage", text, preferProfile);
    } catch (err) {
      console.error(err);
      setIsTyping(false);
    }
  };

  return (
    <section className="page ai-page-v2">
      <header className="ai-header-v2">
        <p className="eyebrow">Your AI Travel Guide</p>
        <h1>Plan by conversation.</h1>
        <p style={{ maxWidth: '600px', opacity: 0.7 }}>
          Ask naturally, get ranked trip options, and jump directly into a synchronized workspace.
        </p>
      </header>

      <div className="ai-workspace-v2">
        <aside className="ai-sidebar-v2">
          <div className="profile-section-v2">
            <h3>Configuration</h3>
            <p className="sidebar-desc-v2">Refine how the AI interprets your profile data.</p>
            <label className="toggle-v2">
              <input
                type="checkbox"
                checked={preferProfile}
                onChange={(event) => setPreferProfile(event.target.checked)}
              />
              <span className="toggle-label-v2">Personalized Matching</span>
              <span className="toggle-switch-v2"></span>
            </label>
          </div>

          <div className="sidebar-footer-v2">
            <img src="/newstickers/sticker6.png" alt="" className="sidebar-sticker-v2" />
            <p className="empty-note">AI Intelligence is active and ready.</p>
          </div>
        </aside>

        <section className="ai-chat-v2">
          <div className="ai-thread-v2" ref={threadRef} data-lenis-prevent>
            {messages.length === 0 && !isTyping ? (
              <div className="ai-empty-state-v2">
                <div className="empty-state-icon-v2">
                  <FiMessageCircle />
                </div>
                <h2>Plan your next adventure.</h2>
                <p>Ask about hidden gems, group itineraries, or budget-friendly routes. I'll analyze your style and suggest ranked options.</p>
                <div className="empty-state-suggestions-v2">
                  <button onClick={() => setPrompt("Recommend a trip based on my profile")} className="suggestion-chip-v2">Trips based on preferences</button>
                  <button onClick={() => setPrompt("Forget my preferences and suggest a random trip")} className="suggestion-chip-v2">Random Trip</button>
                  <button onClick={() => setPrompt("Suggest a trip on a beach")} className="suggestion-chip-v2">Beach Trip</button>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <article key={message.id} className={`ai-bubble-v2 ${message.sender}`}>
                    <header className="bubble-header" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <img 
                        src={message.sender === 'user' ? getAvatarUrl(user?.username, user?.profileUrl) : '/newstickers/sticker1.png'} 
                        alt="" 
                        style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} 
                      />
                      <span>{message.sender === 'user' ? (user?.username || 'Explorer') : 'TripGenius AI'}</span>
                    </header>
                    {message.sender === 'assistant' ? (() => {
                      const parsed = parseAiMessage(message.text)
                      return (
                        <>
                          <Typewriter text={parsed.text} isStreaming={!message.isComplete && activeAiMessageId === message.id} />
                          {parsed.trips && parsed.trips.length > 0 && (
                            <div className="ai-trips-grid">
                              {parsed.trips.map((trip) => (
                                <Link key={trip.id} to={`/app/trip/${trip.id}`} className="ai-trip-card">
                                  <div className="panel">
                                    <div>
                                      <div className="recommendation-badge">
                                        <FiMapPin size={12} /> AI Match
                                      </div>
                                      <h4>{trip.title}</h4>
                                    </div>
                                    <div className="explore-btn">
                                      <span>Explore</span>
                                      <FiExternalLink size={14} />
                                    </div>
                                  </div>
                                </Link>
                              ))}
                            </div>
                          )}
                        </>
                      )
                    })() : (
                      <div className="message-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                      </div>
                    )}
                  </article>
                ))}
                {isTyping && (
                  <article className="ai-bubble-v2 assistant typing-indicator-bubble">
                    <header className="bubble-header">
                      TripGenius AI
                    </header>
                    <div className="ai-typing">
                      <span className="dot"></span>
                      <span className="dot"></span>
                      <span className="dot"></span>
                    </div>
                  </article>
                )}
              </>
            )}
          </div>

          <div className="ai-composer-shell-v2">
            <form className="ai-composer-v2" onSubmit={handleSubmit}>
              <div className="ai-composer-input-wrapper-v2">
                <input
                  className="ai-composer-input-v2"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder={isTyping ? "AI is formulating your strategy..." : "Ask for anything..."}
                  disabled={isTyping}
                />
                <button
                  className="ai-composer-submit-v2"
                  type="submit"
                  disabled={isTyping || !!activeAiMessageId || !prompt.trim()}
                  aria-label="Send message"
                >
                  <FiSend />
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </section>
  )
}

function OfflineAiState() {
  return (
    <section className="page ai-page-v2">
      <div className="ai-workspace-v2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center' }}>
        <div className="ai-empty-state-v2">
          <div className="empty-state-icon-v2" style={{ background: 'rgba(219, 74, 91, 0.1)', color: '#db4a5b' }}>
            <FiMessageCircle />
          </div>
          <h2>AI is sleeping...</h2>
          <p>Sorry, but the AI Assistant isn't available offline. Please reconnect to your signal to continue the conversation.</p>
          <Link className="btn btn-primary" to="/app" style={{ marginTop: '1.5rem' }}>
            Go to discovery
          </Link>
        </div>
      </div>
    </section>
  )
}
