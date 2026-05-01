import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { FiSend, FiMapPin, FiExternalLink } from 'react-icons/fi'
import { useSelector, useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { setToken } from '../data/authSlice'
import * as signalR from '@microsoft/signalr'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import api from '../data/api'

interface AuthStoreState {
  auth: {
    token: string | null
  }
}

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
  const token = useSelector((state: AuthStoreState) => state.auth.token)
  const [prompt, setPrompt] = useState('')
  const baseURL = import.meta.env.VITE_BASE_URL;
  const [preferProfile, setPreferProfile] = useState(true)
  const [isTyping, setIsTyping] = useState(false)
  const [activeAiMessageId, setActiveAiMessageId] = useState<string | null>(null)
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const aiMessageIdRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([])

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
      const res = await api.post('/api/auth/refresh');
      dispatch(setToken({ token: res.data.token }))
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
      setIsTyping(false); // AI started responding
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
    <section className="page ai-page-v2 container">
      <header className="ai-header-v2" style={{ padding: '2rem 0' }}>
        <p className="eyebrow">Expert Expedition Intelligence</p>
        <h1>Plan by conversation.</h1>
        <p style={{ maxWidth: '600px', opacity: 0.7 }}>
          Ask naturally, get ranked trip options, and jump directly into a synchronized workspace.
        </p>
      </header>

      <div className="ai-workspace-v2">
        <aside className="ai-sidebar-v2">
          <div className="profile-section-v2">
          </div>

          <div className="profile-section-v2">
            <h3>Configuration</h3>
            <label className="toggle">
              <input
                type="checkbox"
                checked={preferProfile}
                onChange={(event) => setPreferProfile(event.target.checked)}
              />
              Personalized Matching
            </label>
          </div>

          <div style={{ marginTop: 'auto', textAlign: 'center' }}>
            <img src="/newstickers/sticker6.png" alt="" style={{ width: '160px', opacity: 0.8 }} />
            <p className="empty-note" style={{ marginTop: '0.5rem' }}>AI is ready to assist.</p>
          </div>
        </aside>

        <section className="ai-chat-v2">
          <div className="ai-thread-v2" ref={threadRef}>
            {messages.map((message) => (
              <article key={message.id} className={`ai-bubble-v2 ${message.sender}`}>
                <header className="bubble-header">
                  {message.sender === 'user' ? 'You' : 'TripGenius AI'}
                </header>
                {message.sender === 'assistant' ? (() => {
                  const parsed = parseAiMessage(message.text)
                  return (
                    <>
                      <Typewriter text={parsed.text} isStreaming={!message.isComplete && activeAiMessageId === message.id} />
                      {parsed.trips && parsed.trips.length > 0 && (
                        <div className="ai-trips-grid">
                          {parsed.trips.map((trip) => (
                            <Link key={trip.id} to={`/trip/${trip.id}`} className="ai-trip-card">
                              <div className="panel">
                                <div>
                                  <div className="recommendation-badge">
                                    <FiMapPin size={12} /> AI Match
                                  </div>
                                  <h4>{trip.title}</h4>
                                </div>
                                <div className="explore-btn">
                                  <span>Explore Expedition</span>
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
          </div>

          <form className="ai-composer-v2" onSubmit={handleSubmit}>
            <div className="ai-composer-input-v2">
              <input
                className="input"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={isTyping ? "AI is thinking..." : "Ask for the kind of trip you want..."}
                style={{ borderRadius: '12px' }}
                disabled={isTyping}
              />
              <button
                className="btn btn-primary"
                type="submit"
                style={{ borderRadius: '12px', opacity: isTyping ? 0.5 : 1, cursor: isTyping ? 'not-allowed' : 'pointer' }}
                disabled={isTyping}
              >
                <FiSend />
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
  )
}
