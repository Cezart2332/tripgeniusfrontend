import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { FiSend, FiMapPin, FiExternalLink, FiMessageCircle, FiArrowLeft, FiArrowDown, FiLink } from 'react-icons/fi'
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

export function parseAiMessage(raw: string): ParsedMessage {
  // Găsește tot ce e între [TRIPS: și ultimul ]
  const tripMatch = raw.match(/\[TRIPS:(.*?)\]+\s*$/)

  const partialTagIndex = raw.indexOf('[TRIPS:')
  if (partialTagIndex !== -1 && !tripMatch) {
    return { text: raw.slice(0, partialTagIndex).trim(), trips: [] }
  }

  if (!tripMatch) return { text: raw, trips: [] }

  try {
    // Curăță acolade/brackets în plus înainte să parsezi
    const jsonStr = tripMatch[1].trim().replace(/}+\]$/, '}]').replace(/\}+$/, '}')
    const parsed = JSON.parse(jsonStr)
    const text = raw.replace(/\[TRIPS:.*$/s, '').trim()
    return { text, trips: parsed.trips || [] }
  } catch {
    const text = raw.replace(/\[TRIPS:.*$/s, '').trim()
    return { text, trips: [] }
  }
}

interface LinkCard {
  title: string
  url: string
}

export function parseAiLinks(raw: string): { text: string; links: LinkCard[] } {
  const linkMatch = raw.match(/\[LINKS:(.*?)\]+\s*$/s)

  const partialTagIndex = raw.indexOf('[LINKS:')
  if (partialTagIndex !== -1 && !linkMatch) {
    return { text: raw.slice(0, partialTagIndex).trim(), links: [] }
  }

  if (!linkMatch) return { text: raw, links: [] }

  try {
    const jsonStr = linkMatch[1].trim()
    const parsed = JSON.parse(jsonStr)
    const text = raw.replace(/\[LINKS:.*$/s, '').trim()
    return { text, links: parsed.links || [] }
  } catch {
    const text = raw.replace(/\[LINKS:.*$/s, '').trim()
    return { text, links: [] }
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

/**
 * StreamingMessage — renders AI text.
 * During streaming: plain text (pre-wrap) + blinking cursor. No markdown parsing → zero layout shifts.
 * On completion: swap to ReactMarkdown for proper formatting.
 */
const StreamingMessage = ({ text, isStreaming }: { text: string; isStreaming?: boolean }) => {
  if (isStreaming) {
    return (
      <div className="message-content-v3 streaming-text-v3">
        <span>{text}</span>
        <span className="typing-cursor" />
      </div>
    );
  }

  return (
    <div className="message-content-v3">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialScrollDone = useRef(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null)

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

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [prompt]);

  const fetchChatHistory = async () => {
    try {
      const res = await api.get<AiChatResponse[]>('/api/ai/history')
      const historyMessages: Message[] = res.data.map((item) => ({
        id: `hist-${item.role}-${item.message.slice(0, 20)}-${item.message.length}`, // More stable ID than randomUUID for history
        text: item.message,
        sender: item.role.toLowerCase() === 'user' ? 'user' : 'assistant',
        isComplete: true
      }))
      
      setMessages(prev => {
        // Filter out any history messages that already exist (by stable ID)
        const existingIds = new Set(prev.map(m => m.id));
        const uniqueHistory = historyMessages.filter(m => !existingIds.has(m.id));
        return [...prev, ...uniqueHistory];
      })
      
      // If the backend returns the FULL history, we should probably just replace:
      setMessages(historyMessages)
    }
    catch (error) {
      console.error(error)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect -- reset chat UI when SignalR connection (re)mounts */
  useEffect(() => {
    if (!threadRef.current) {
      return
    }
    const refreshToken = async () => {
      if (!navigator.onLine) return;
      try {
        const res = await api.post('api/auth/refresh');
        dispatch(setToken({ token: res.data.token }))
      } catch {
        navigate('/login', { replace: true })
      }
    }
    if (!token) {
      refreshToken()
    }

    // Initial scroll handled by messages effect

    // Reset state on initialization to avoid "stuck" UI if connection restarted
    setIsTyping(false);
    setActiveAiMessageId(null);
    aiMessageIdRef.current = null;

    if (!token) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${baseURL}/hubs/ai-chat?access_token=${token}`)
      .withAutomaticReconnect([1000, 2000, 5000, 10000, 30000])
      .build()

    connection.on("StartAiMessage", () => {
      const id = crypto.randomUUID()
      setMessages((prev) => [...prev, { id, text: "", sender: 'assistant', isComplete: false }])
      aiMessageIdRef.current = id;
      setActiveAiMessageId(id)
      setIsTyping(false);
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
    
    connection.onreconnecting((error) => {
      console.warn("SignalR Reconnecting:", error);
      setIsTyping(false); // Clear typing state if connection is unstable
      setActiveAiMessageId(null);
    });

    connection.onreconnected((connectionId) => {
      console.log("SignalR Reconnected. Connection ID:", connectionId);
    });

    connection.onclose((error) => {
      console.error("SignalR Connection Closed:", error);
      setIsTyping(false);
      setActiveAiMessageId(null);
    });

    connectionRef.current = connection

    let isStopped = false;
    const start = async () => {
      try {
        await connection.start()
        if (!isStopped) {
          await connection.invoke("JoinAiChat")
        }
      }
      catch (error) {
        console.error("SignalR Connection Error:", error)
      }
    }
    start()

    return () => {
      isStopped = true;
      const stop = async () => {
        try {
          if (connection.state === signalR.HubConnectionState.Connected) {
            await connection.invoke("LeaveAiChat")
          }
        }
        catch (error) {
          console.log("LeaveAiChat Error:", error)
        }
        await connection.stop()
      }
      stop()
      connectionRef.current = null;
    }
  }, [token, baseURL, dispatch, navigate])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!token) {
      return
    }
    const loadHistory = async () => {
      await fetchChatHistory()
    }
    void loadHistory()
  }, [token])

  const handleScroll = () => {
    const thread = threadRef.current;
    if (thread) {
      const isAtBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 150;
      setShowScrollButton(!isAtBottom && thread.scrollHeight > thread.clientHeight);
    }
  };

  const scrollToBottom = () => {
    const thread = threadRef.current;
    if (thread) {
      thread.scrollTo({
        top: thread.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect -- scroll position sync after message stream updates */
  useEffect(() => {
    const thread = threadRef.current;
    if (thread && messages.length > 0) {
      if (!initialScrollDone.current) {
        // Force scroll to bottom on initial history load
        thread.scrollTop = thread.scrollHeight;
        initialScrollDone.current = true;
      } else {
        // Auto-scroll only if already near bottom (streaming/new messages)
        const isAtBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 250;
        if (isAtBottom) {
          thread.scrollTop = thread.scrollHeight;
        }
      }
      handleScroll();
    }
  }, [messages, isTyping])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  if (isOffline) {
    return <OfflineAiState />
  }

  return (
    <section className="ai-workspace-v2 standalone-ai">
      <div className="ai-mobile-header">
        <button className="mobile-back-btn" onClick={() => navigate('/app')}>
          <FiArrowLeft />
        </button>
        <span className="mobile-title">AI Assistant</span>
      </div>

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
        <div 
          className="ai-thread-v2" 
          ref={threadRef} 
          data-lenis-prevent
          onScroll={handleScroll}
        >
          {messages.length === 0 && !isTyping ? (
            <div className="ai-empty-state-v3">
              <header className="empty-state-header-v3">
                <h1>Where are we heading next?</h1>
                <p>I'm your TripGenius AI. Ask me about itineraries, hidden gems, or group planning.</p>
              </header>
              
              <div className="empty-state-suggestions-v3">
                <div className="suggestion-card-v3" onClick={() => setPrompt("Plan a 3-day trip to Tokyo for a group of 5")}>
                  <div className="suggestion-icon"><FiMapPin /></div>
                  <h4>Group Itineraries</h4>
                  <p>Tokyo for a group of 5</p>
                </div>
                <div className="suggestion-card-v3" onClick={() => setPrompt("Suggest some hidden gems in Iceland")}>
                  <div className="suggestion-icon"><FiExternalLink /></div>
                  <h4>Hidden Gems</h4>
                  <p>Unexplored spots in Iceland</p>
                </div>
                <div className="suggestion-card-v3" onClick={() => setPrompt("Recommend a beach trip based on my style")}>
                  <div className="suggestion-icon"><FiSend /></div>
                  <h4>Style Matching</h4>
                  <p>Beaches based on my profile</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="messages-container-v3">
              {messages.map((message) => (
                <div key={message.id} className={`ai-message-row-v3 ${message.sender}`}>
                  <div className="message-inner-v3">
                    <header className="message-header-v3">
                      <img 
                        src={message.sender === 'user' ? getAvatarUrl(user?.username, user?.profileUrl) : '/newstickers/sticker1.png'} 
                        alt="" 
                        className="message-avatar-v3"
                      />
                      <span>{message.sender === 'user' ? (user?.username || 'Explorer') : 'TripGenius AI'}</span>
                    </header>
                    
                    <div className="message-content-v3">
                      {message.sender === 'assistant' ? (() => {
                        // Strip [LINKS:...] first, then strip [TRIPS:...]
                        const withLinks = parseAiLinks(message.text)
                        const parsed = parseAiMessage(withLinks.text)
                        const links = withLinks.links
                        return (
                          <>
                            <StreamingMessage text={parsed.text} isStreaming={!message.isComplete && activeAiMessageId === message.id} />
                            {parsed.trips && parsed.trips.length > 0 && (
                              <div className="ai-trips-grid-v3">
                                {parsed.trips.map((trip) => (
                                  <Link key={trip.id} to={`/app/trip/${trip.id}`} className="ai-trip-card-v3">
                                    <div className="recommendation-badge">
                                      <FiMapPin size={12} /> AI Match
                                    </div>
                                    <h4>{trip.title}</h4>
                                    <div className="explore-btn">
                                      <span>Explore</span>
                                      <FiExternalLink size={14} />
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            )}
                            {links.length > 0 && (
                              <div className="ai-links-grid-v3">
                                {links.map((link, i) => (
                                  <a
                                    key={i}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ai-link-card-v3"
                                  >
                                    <div className="link-card-icon-v3">
                                      <FiLink size={14} />
                                    </div>
                                    <div className="link-card-body-v3">
                                      <h4>{link.title}</h4>
                                      <span className="link-card-url-v3">{new URL(link.url).hostname.replace('www.', '')}</span>
                                    </div>
                                    <div className="link-card-arrow-v3">
                                      <FiExternalLink size={14} />
                                    </div>
                                  </a>
                                ))}
                              </div>
                            )}
                          </>
                        )
                      })() : (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="ai-message-row-v3 assistant">
                  <div className="message-inner-v3 ai-thinking-v3">
                    <header className="message-header-v3">
                      <img src="/newstickers/sticker1.png" alt="" className="message-avatar-v3" />
                      <span>TripGenius AI</span>
                    </header>
                    <div className="ai-thinking-body-v3">
                      <div className="ai-thinking-dots-v3">
                        <span />
                        <span />
                        <span />
                      </div>
                      <span className="ai-thinking-label-v3">AI is thinking</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {showScrollButton && (
          <button 
            className="ai-scroll-down-btn" 
            onClick={scrollToBottom}
            aria-label="Scroll to bottom"
          >
            <FiArrowDown />
          </button>
        )}

        <div className="ai-composer-shell-v3">
          <form className="ai-composer-v3" onSubmit={handleSubmit}>
            <div className="ai-composer-input-wrapper-v3">
              <textarea
                ref={textareaRef}
                className="ai-composer-input-v3"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isTyping ? "Formulating strategy..." : "Ask me anything..."}
                disabled={isTyping}
                rows={1}
              />
              <button
                className="ai-composer-submit-v3"
                type="submit"
                disabled={isTyping || !!activeAiMessageId || !prompt.trim()}
                aria-label="Send message"
              >
                <FiSend />
              </button>
            </div>
            <p className="composer-footer-v3">TripGenius AI can make mistakes. Verify important info.</p>
          </form>
        </div>
      </section>
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
