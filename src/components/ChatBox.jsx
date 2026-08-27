import { useEffect, useRef, useState } from 'react';

const helpfulLinks = [
  { text: 'Learn more about sewer camera inspections in Southeastern Pennsylvania.', href: 'https://protrenchless.com/sewer-camera-inspection/' },
  { text: 'Compare trenchless sewer repair and excavation.', href: 'https://protrenchless.com/trenchless-sewer-repair/' },
  { text: 'Schedule a Pro Trenchless sewer inspection.', href: 'https://answers.protrenchless.com/#lead-form' }
];

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
  const listRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }), 80);
    }
  }, [messages, open]);

  async function sendMessage() {
    const text = String(input || '').trim();
    if (!text) return;
    const userMsg = { role: 'user', content: text };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setLoading(true);
    // Short-circuit very short greetings with a concise local reply to avoid long AI responses
    const greetingRe = /^(hi|hello|hey|howdy|good\s(morning|afternoon|evening))\b[.!]?$/i;
    if (greetingRe.test(text) && text.length < 20) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Hi — how can I help? Ask a brief question about drains or sewer issues.' }]);
      setLoading(false);
      return;
    }

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: 'symptom-checker', userType: selectedType || 'Homeowner', messages: [userMsg] })
      });
      const data = await resp.json();
      const answer = (data && data.answer) ? data.answer : 'Sorry — no answer available.';
      setMessages((m) => [...m, { role: 'assistant', content: answer }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Error contacting server. Try again later.' }]);
    } finally {
      setLoading(false);
    }
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
        <div className={`chat-panel panel ${inline ? 'chat-embedded' : ''}`}>
          {inline ? (
            <div className="chat-hero">
              <h2 className="chat-hero-title">How can we help you today?</h2>
              <p className="chat-hero-sub">Chat with Flo for fast help with sewer and drain answers or scheduling.</p>

              <div className="chat-input-bar">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  rows={1}
                  placeholder="Describe the issue (e.g. basement backup when it rains)"
                  className="chat-input-field"
                />
                <div className="chat-input-actions">
                  <button className="clear-btn" onClick={() => setInput('')}>Clear</button>
                  <button className="ask-btn btn" onClick={() => sendMessage()} disabled={loading}>{loading ? 'Thinking...' : 'Ask Flo'}</button>
                </div>
              </div>

              <div className="chat-suggested">
                <button className="suggestion" onClick={() => setInput('Why is my basement backing up when it rains?')}>Why is my basement backing up?</button>
                <button className="suggestion" onClick={() => setInput('How much does a camera inspection cost?')}>Camera inspection cost</button>
                <button className="suggestion" onClick={() => setInput('What causes recurring clogs?')}>Recurring clogs causes</button>
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

          <div className="chat-conversation panel" style={{ marginTop: '1rem' }}>
            <div ref={listRef} className="chat-messages" style={{ maxHeight: inline ? '40vh' : '320px', overflow: 'auto', padding: '1rem' }}>
              {messages.length === 0 && (
                <div className="bubble">{inline ? 'Ask Flo a question and get a quick answer.' : 'Hi — ask any question about drains, sewer problems, or repairs.'}</div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`msg ${m.role === 'user' ? 'user' : 'assistant'}`} style={{ marginTop: '0.6rem' }}>
                  <div className={`avatar ${m.role === 'user' ? 'avatar-user' : 'avatar-assistant'}`} aria-hidden>
                    {m.role === 'user' ? '👤' : '🤖'}
                  </div>
                  <div className="msg-content">
                    <div className={`bubble ${m.role === 'user' ? 'user' : 'assistant-bubble'}`}>
                      {m.role === 'user' ? m.content : <FormattedResponse text={m.content} />}
                    </div>
                    <div className="ts mini">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

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
