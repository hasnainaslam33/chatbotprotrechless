import StatusBadge from './StatusBadge.jsx';

const severityMeta = {
  high: { label: 'High', tone: 'high' },
  medium: { label: 'Medium', tone: 'medium' },
  low: { label: 'Low', tone: 'low' }
};

/**
 * The five items most likely to cost the homeowner money or warranty coverage.
 * Severity is derived from documented consequence, never from tone of voice.
 */
export default function TopRisks({ risks = [] }) {
  if (!risks.length) {
    return (
      <section className="ec-section ec-risks" aria-labelledby="ec-risks-heading">
        <h2 className="ec-section-title" id="ec-risks-heading">
          5 Things You Should Clarify Before Signing
        </h2>
        <p className="mini">
          Nothing in the highest-consequence categories came back missing or ambiguous. Still review the full comparison below before signing.
        </p>
      </section>
    );
  }

  return (
    <section className="ec-section ec-risks" aria-labelledby="ec-risks-heading">
      <h2 className="ec-section-title" id="ec-risks-heading">
        {risks.length} Thing{risks.length === 1 ? '' : 's'} You Should Clarify Before Signing
      </h2>
      <p className="mini ec-section-sub">
        Ranked by how much money or warranty coverage is at stake — based only on what the documents do and do not say.
      </p>

      <ol className="ec-risk-list">
        {risks.map((risk, index) => {
          const severity = severityMeta[risk.severity] || severityMeta.medium;
          return (
            <li className={`ec-risk ec-risk-${severity.tone}`} key={risk.id}>
              <div className="ec-risk-rank" aria-hidden="true">
                {index + 1}
              </div>
              <div className="ec-risk-body">
                <div className="ec-risk-top">
                  <h3 className="ec-risk-title">{risk.title}</h3>
                  <span className={`ec-severity ec-severity-${severity.tone}`}>{severity.label} risk</span>
                </div>

                <div className="ec-risk-meta">
                  <span className="ec-risk-contractor">{risk.contractorName}</span>
                  <span className="ec-risk-dot" aria-hidden="true">
                    ·
                  </span>
                  <span className="ec-risk-category">{risk.category}</span>
                  <StatusBadge status={risk.status} compact />
                </div>

                <p className="ec-risk-why">{risk.description}</p>

                {risk.suggestedQuestion ? (
                  <div className="ec-risk-ask">
                    <span className="ec-risk-ask-label">Ask them:</span>
                    <span className="ec-risk-ask-text">“{risk.suggestedQuestion}”</span>
                  </div>
                ) : null}

                {risk.sourceText ? (
                  <details className="ec-evidence">
                    <summary>Show the wording this came from</summary>
                    <blockquote>{risk.sourceText}</blockquote>
                  </details>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
