import React from 'react';

export function AIResponse({ result }) {
  if (!result) return null;

  return (
    <div className={`result-box show result-${result.cls}`}>
      {/* Header Card with Urgency */}
      <div className="result-header-card">
        <div className="urgency-label">Urgency level</div>
        <div className="urgency-row">
          <span className={`badge urgency-badge ${result.cls}`}>{result.risk}</span>
          <strong>{result.title}</strong>
        </div>
        <p>{result.summary}</p>
      </div>

      {/* Likely Causes Section */}
      {result.likelyCauses && result.likelyCauses.length > 0 ? (
        <div className="result-section">
          <div className="result-section-title">Likely cause categories</div>
          <ul className="result-bullets">
            {result.likelyCauses.map((item, idx) => (
              <li key={`cause-${idx}`}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Recommended Next Steps Section */}
      {result.nextSteps && result.nextSteps.length > 0 ? (
        <div className="result-section">
          <div className="result-section-title">Recommended next steps</div>
          <ol className="result-steps">
            {result.nextSteps.map((step, idx) => (
              <li key={`step-${idx}`}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}

      {/* Questions Section */}
      {result.questions && result.questions.length > 0 ? (
        <div className="result-section">
          <div className="result-section-title">Questions to ask or information to gather</div>
          <ul className="result-bullets">
            {result.questions.map((question, idx) => (
              <li key={`question-${idx}`}>{question}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Soft CTA Section */}
      {result.softCTA ? (
        <div className="result-section">
          <div className="result-section-title">Suggested next step</div>
          <p>{result.softCTA}</p>
        </div>
      ) : null}

      {/* Helpful Links Section */}
      {result.links && result.links.length > 0 ? (
        <div className="result-section">
          <div className="result-section-title">Helpful links</div>
          <div className="link-list">
            {result.links.map((link, idx) => (
              <a
                key={`link-${idx}`}
                href={link.href}
                target={link.href.startsWith('http') ? '_blank' : '_self'}
                rel={link.href.startsWith('http') ? 'noopener noreferrer' : ''}
              >
                <span>{link.text}</span>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {/* Disclaimer Section */}
      {result.disclaimer ? (
        <div className="disclaimer">
          <strong>Disclaimer:</strong> {result.disclaimer}
        </div>
      ) : null}
    </div>
  );
}
