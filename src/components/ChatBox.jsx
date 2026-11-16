import { useEffect, useRef, useState } from 'react';

const helpfulLinks = [
  { text: 'Learn more about sewer camera inspections in Southeastern Pennsylvania.', href: 'https://protrenchless.com/sewer-camera-inspection/' },
  { text: 'Compare trenchless sewer repair and excavation.', href: 'https://protrenchless.com/trenchless-sewer-repair/' },
  { text: 'Schedule a Pro Trenchless sewer inspection.', href: 'https://answers.protrenchless.com/#lead-form' }
];

const suggestions = [
  'Why does my drain keep clogging?',
  'Can my sewer be fixed without digging?',
  'What affects sewer repair costs?',
  'Buying a home? What should I check?'
];

const trustPoints = ['Master plumber led', 'Local, family-owned', 'Inspection-based recommendations'];

function FormattedResponse({ text }) {
  const fullText = String(text || '');
  const cleanLine = (line) => line
    .replace(/^\s*#{1,6}\s*/, '')
    .replace(/\*+/g, '')
    .replace(/`+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const lines = fullText.split('\n').map(cleanLine);
  
  // Detect urgency level
  const urgencyMatch = fullText.match(/(?:urgency\s*level\s*:\s*)?(urgent|high|emergency|critical|medium|low|scheduled)/i);
  let urgencyLevel = 'medium';
  if (urgencyMatch) {
    const m = urgencyMatch[0].toLowerCase();
    if (m.includes('emergency') || m.includes('critical')) urgencyLevel = 'emergency';
    else if (m.includes('urgent') || m.includes('high')) urgencyLevel = 'urgent';
    else if (m.includes('low')) urgencyLevel = 'low';
    else if (m.includes('scheduled')) urgencyLevel = 'scheduled';
  }

  const sections = [];
  let currentSection = null;
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i];
    if (!trimmed) continue;

    const isUrgencyLine = /^urgency\s*level\s*:/i.test(trimmed);
    const isSectionHeader = !isUrgencyLine && (trimmed.endsWith(':') || (trimmed.length < 60 && /^[A-Z][A-Z\s]*$/.test(trimmed)));

    if (isUrgencyLine) continue;
    
    if (isSectionHeader) {
      if (currentSection) sections.push(currentSection);
      const title = trimmed.replace(/:$/, '');
      currentSection = { type: 'section', title, items: [] };
      inList = false;
    } else if (currentSection && (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('✓') || trimmed.match(/^\d+[.)]/) || trimmed.startsWith('Step'))) {
      const content = trimmed.replace(/^[-•✓]\s*/, '').replace(/^\d+[.)]\s*/, '').trim();
      currentSection.items.push(content);
      inList = true;
    } else if (trimmed) {
      if (!inList && currentSection && currentSection.items.length === 0) {
        currentSection.summary = (currentSection.summary || '') + ' ' + trimmed;
      } else {
        if (currentSection) sections.push(currentSection);
        sections.push({ type: 'paragraph', content: trimmed });
        currentSection = null;
        inList = false;
      }
    }
  }
  if (currentSection) sections.push(currentSection);

  return (
    <div className={`formatted-response urgency-${urgencyLevel}`}>
      <div className="response-header">
        <span className={`urgency-badge urgency-${urgencyLevel}`}>{urgencyLevel.toUpperCase()}</span>
        <h3 className="response-title">Guided AI Recommendation</h3>
      </div>
      <div className="response-body">
        {sections.map((sec, i) => (
          <div key={i} className="response-section">
            {sec.type === 'section' && (
              <>
                <h4 className="section-heading">{sec.title}</h4>
                {sec.summary && <p className="section-summary">{sec.summary.trim()}</p>}
                {sec.items.length > 0 && (
                  <ul className="response-list">
                    {sec.items.map((item, j) => (
                      <li key={j}><span className="checkmark">✓</span> {item}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {sec.type === 'paragraph' && <p className="response-para">{sec.content}</p>}
          </div>
        ))}
        <div className="response-section response-links-section">
          <h4 className="section-heading">Helpful links</h4>
          <div className="response-links">
            {helpfulLinks.map((link) => (
              <a key={link.href} className="response-link" href={link.href} target="_blank" rel="noopener noreferrer">
                <span>{link.text}</span>
                <span className="response-link-arrow" aria-hidden="true">→</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatBox({ selectedType = 'Homeowner', inline = false }) {
  const [open, setOpen] = useState(Boolean(inline));
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const assistantStartRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const activeRequestRef = useRef(null);

  const newestAssistant = messages.filter((message) => message.role === 'assistant').at(-1);
  useEffect(() => {
    if (!newestAssistant || !assistantStartRef.current || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const target = assistantStartRef.current;
    const targetTop = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    container.scrollTo({ top: Math.max(0, targetTop - 8), behavior: 'smooth' });
  }, [newestAssistant?.id]);

  async function sendMessage(textOverride) {
    const text = String(textOverride ?? input ?? '').trim();
    if (!text || loading) return;
    setStarted(true);
    const userMsg = {
      id: `user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role: 'user',
      content: text,
      time: Date.now()
    };
    const thinkingMsg = {
      id: `assistant-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role: 'assistant',
      isThinking: true,
      content: '...',
      time: Date.now()
    };
    setMessages((current) => [...current, userMsg, thinkingMsg]);
    setInput('');
    setLoading(true);
    // Short-circuit very short greetings with a concise local reply to avoid long AI responses
    const greetingRe = /^(hi|hello|hey|howdy|good\s(morning|afternoon|evening))\b[.!]?$/i;
    if (greetingRe.test(text) && text.length < 20) {
      setMessages((current) => current.map((message) => message.id === thinkingMsg.id
        ? { ...message, isThinking: false, time: Date.now(), content: 'Hi — how can I help? Ask a brief question about drains or sewer issues.' }
        : message));
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    activeRequestRef.current = controller;
    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: 'symptom-checker', userType: selectedType || 'Homeowner', messages: [userMsg] }),
        signal: controller.signal
      });
      const data = await resp.json();
      const answer = (data && data.answer) ? data.answer : 'Sorry — no answer available.';
      setMessages((current) => current.map((message) => message.id === thinkingMsg.id
        ? { ...message, isThinking: false, time: Date.now(), content: answer }
        : message));
    } catch (err) {
      if (err.name === 'AbortError') return;
      setMessages((current) => current.map((message) => message.id === thinkingMsg.id
        ? { ...message, isThinking: false, time: Date.now(), content: 'Error contacting server. Try again later.' }
        : message));
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
        setLoading(false);
      }
    }
  }

  function closeConversation() {
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    setInput('');
    setMessages([]);
    setStarted(false);
    setLoading(false);
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading) sendMessage();
    }
  }

  return (
    <div className={`chat-widget ${inline ? 'inline' : ''}`} aria-live="polite">
      {!open && !inline && (
        <button className="chat-toggle btn" onClick={() => setOpen(true)} aria-label="Open chat">
          Chat with us
        </button>
      )}

      {open && (
        <div className={`chat-panel panel ${inline ? 'chat-embedded' : ''} ${started ? 'chat-started' : ''}`}>
          {inline ? (
            <div className="chat-shell">
              {started && (
                <div className="chat-session-controls">
                  <button
                    type="button"
                    className="chat-close-btn"
                    onClick={closeConversation}
                    aria-label="Close conversation and return to the start"
                  >
                    <span aria-hidden="true">×</span>
                    Close
                  </button>
                </div>
              )}
              <div className={`chat-hero ${started ? 'is-hidden' : ''}`}>
                <span className="ah-kicker">Pro Trenchless Answer Engine</span>
                <span className="ah-pill"><strong>Meet Flo</strong> <span aria-hidden="true">·</span> Your AI sewer &amp; drain guide</span>
                <h1 className="ah-title">Sewer &amp; drain questions?<span>Get clear answers.</span></h1>
                <p className="chat-hero-sub">Understand the problem, explore your options, and know your next step.</p>
              </div>

              <div ref={scrollContainerRef} className={`chat-message-stream ${started ? 'is-visible' : ''}`}>
                <div className="chat-messages">
                  {messages.map((message, index) => {
                    const isAssistant = message.role === 'assistant';
                    const isNewestAssistant = isAssistant && message.id === newestAssistant?.id;
                    return (
                      <div
                        key={message.id ?? `${message.role}-${index}`}
                        ref={isNewestAssistant ? assistantStartRef : null}
                        className={`msg ${isAssistant ? 'assistant' : 'user'}`}
                      >
                        <div className={`avatar ${isAssistant ? 'avatar-assistant' : 'avatar-user'}`} aria-hidden>
                          {isAssistant ? '🤖' : '👤'}
                        </div>
                        <div className="msg-content">
                          <div className={`bubble ${isAssistant ? 'assistant-bubble' : 'user'} ${message.isThinking ? 'thinking-bubble' : ''}`}>
                            {message.isThinking ? (
                              <div className="thinking-wrap" aria-label="Flo is thinking" role="status">
                                <span className="thinking-dot" />
                                <span className="thinking-dot" />
                                <span className="thinking-dot" />
                              </div>
                            ) : isAssistant ? <FormattedResponse text={message.content} /> : message.content}
                          </div>
                          <div className="ts mini">{new Date(message.time ?? Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={`chat-composer ${started ? 'is-bottom' : 'is-center'}`}>
                <div className="ah-card">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    rows={2}
                    placeholder="What’s happening with your sewer or drain?"
                    aria-label="Describe your sewer or drain problem"
                    className="ah-input"
                  />
                  <div className="ah-card-foot">
                    <span className="ah-hint">Ask in your own words.</span>
                    <button className="ask-btn btn" onClick={() => sendMessage()} disabled={loading}>
                      {loading ? 'Thinking...' : <>Get my answer <span aria-hidden="true">↑</span></>}
                    </button>
                  </div>
                </div>
              </div>

              <div className={`ah-extras ${started ? 'is-hidden' : ''}`}>
                <div className="ah-chips">
                  {suggestions.map((question) => (
                    <button key={question} type="button" className="ah-chip" onClick={() => sendMessage(question)}>
                      <svg className="ah-chip-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3 8.7 8.7 0 0 1-3.6-.8L3 21l1.9-5A8.2 8.2 0 0 1 4 11.5 8.4 8.4 0 0 1 12.5 3.2 8.4 8.4 0 0 1 21 11.5z" /></svg>
                      <span>{question}</span>
                      <svg className="ah-chip-arrow" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
                    </button>
                  ))}
                </div>

                <ul className="ah-trust">
                  {trustPoints.map((point) => (
                    <li key={point}>
                      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#dff1d2" /><path d="m7 12.5 3.2 3.2L17 9" fill="none" stroke="#4d9a1f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {point}
                    </li>
                  ))}
                </ul>

                <a className="ah-person" href="tel:4842065551">Prefer a person? Talk to our team <span aria-hidden="true">→</span></a>
                <p className="ah-disclaimer">Flo provides AI guidance. An on-site inspection confirms pipe condition.</p>
              </div>
            </div>
          ) : (
            <div className="chat-top">
              <div>
                <strong>Ask an Expert</strong>
                <div className="mini">Quick answers and guidance</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button className="btn secondary" onClick={() => { setOpen(false); }} aria-label="Close chat">Close</button>
              </div>
            </div>
          )}

          {!inline && <div className="chat-conversation panel" style={{ marginTop: '1rem' }}>
            <div ref={scrollContainerRef} className="chat-messages" style={{ maxHeight: '320px', overflow: 'auto', padding: '1rem' }}>
              {messages.length === 0 && (
                <div className="bubble">Hi — ask any question about drains, sewer problems, or repairs.</div>
              )}
              {messages.map((message, index) => {
                const isAssistant = message.role === 'assistant';
                const isNewestAssistant = isAssistant && message.id === newestAssistant?.id;
                return (
                  <div key={message.id ?? `${message.role}-${index}`} ref={isNewestAssistant ? assistantStartRef : null} className={`msg ${isAssistant ? 'assistant' : 'user'}`}>
                    <div className={`avatar ${isAssistant ? 'avatar-assistant' : 'avatar-user'}`} aria-hidden>
                      {isAssistant ? '🤖' : '👤'}
                    </div>
                    <div className="msg-content">
                      <div className={`bubble ${isAssistant ? 'assistant-bubble' : 'user'} ${message.isThinking ? 'thinking-bubble' : ''}`}>
                        {message.isThinking ? (
                          <div className="thinking-wrap" aria-label="Flo is thinking" role="status">
                            <span className="thinking-dot" />
                            <span className="thinking-dot" />
                            <span className="thinking-dot" />
                          </div>
                        ) : isAssistant ? <FormattedResponse text={message.content} /> : message.content}
                      </div>
                      <div className="ts mini">{new Date(message.time ?? Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>}

          {!inline && (
            <div className="chat-input" style={{ marginTop: '0.9rem', display: 'flex', gap: '0.6rem' }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                rows={2}
                placeholder="Type your question and press Enter"
                style={{ flex: 1, resize: 'none', padding: '0.6rem', borderRadius: '0.6rem', border: '1px solid #c9d8e6' }}
              />
              <button className="btn" onClick={() => sendMessage()} disabled={loading} aria-label="Send message">
                {loading ? 'Thinking...' : 'Send'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
