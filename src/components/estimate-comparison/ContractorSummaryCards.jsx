import { warrantySummary } from '../../lib/comparisonScoring.js';

function formatPrice(value) {
  if (!Number.isFinite(value) || value <= 0) return 'Not stated';
  return `$${value.toLocaleString()}`;
}

function scoreTone(score) {
  if (score >= 75) return 'strong';
  if (score >= 50) return 'mixed';
  return 'thin';
}

function riskLabel(value = '') {
  const text = String(value || '').toLowerCase();
  if (!text || text.includes('low')) return 'LOW';
  if (text.includes('medium')) return 'MEDIUM';
  if (text.includes('high')) return 'HIGH';
  return 'LOW';
}

function deriveRecommendedOption(contractor) {
  if (!Array.isArray(contractor.repairOptions) || !contractor.repairOptions.length) {
    return contractor.proposedMethod || 'Not stated';
  }
  const sorted = [...contractor.repairOptions].sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  const recommended = sorted[0] || contractor.repairOptions[0];
  return recommended.name || recommended.method || 'Recommended option';
}

function deriveQuestionsRemaining(contractor = {}) {
  const count = typeof contractor.missingCount === 'number' ? contractor.missingCount : 0;
  return Math.max(0, Math.min(12, count));
}

function deriveExtraCostRisk(contractor = {}) {
  const warnings = Number(contractor.warningCount || 0);
  if (warnings >= 8) return 'HIGH';
  if (warnings >= 4) return 'MEDIUM';
  return 'LOW';
}

function deriveMainResult(contractor = {}) {
  const labels = Array.isArray(contractor.labels) && contractor.labels.length ? contractor.labels : [];
  if (labels.length) return labels[0];
  return contractor.proposedMethod ? `Method: ${contractor.proposedMethod}` : 'Documentation review completed';
}

/**
 * Three cards side by side on desktop, stacked on mobile.
 * Each card keeps the same information structure so the customer can compare
 * the same categories without losing focus on the details that matter.
 */
export default function ContractorSummaryCards({ contractors = [] }) {
  return (
    <section className="ec-section" aria-labelledby="ec-summary-heading">
      <h2 className="ec-section-title" id="ec-summary-heading">
        Your Three Companies Compared
      </h2>
      <p className="mini ec-section-sub">Each company is scored using the same 100-point system.</p>

      <div className={`ec-contractor-grid ec-contractor-grid-${contractors.length}`}>
        {contractors.map((contractor) => (
          <article className="ec-contractor-card" key={contractor.id}>
            <header className="ec-contractor-head">
              <span className="ec-contractor-slot">Company {contractor.slot}</span>
              <h3 className="ec-contractor-name">{contractor.contractorName}</h3>
              {contractor.fileName ? (
                <span className="ec-contractor-file" title={contractor.fileName}>
                  {contractor.fileName}
                </span>
              ) : null}
            </header>

            <div className={`ec-score-block ec-score-${scoreTone(contractor.overallScore)}`}>
              <div className="ec-score-title">Overall Proposal Score</div>
              <div className="ec-score-value">
                {contractor.overallScore}
                <span className="ec-score-max">/100</span>
              </div>
              <div className="ec-score-caption">
                This score evaluates the written proposal, price clarity, warranty, proof of work, and customer protections. It does not
                predict contractor workmanship.
              </div>
              <div className="ec-score-bar" role="img" aria-label={`Overall proposal score ${contractor.overallScore} out of 100`}>
                <span style={{ width: `${contractor.overallScore}%` }} />
              </div>
            </div>

            <dl className="ec-contractor-facts">
              <div>
                <dt>Price</dt>
                <dd className="ec-fact-strong">{formatPrice(contractor.totalPrice)}</dd>
              </div>
              <div>
                <dt>Recommended option</dt>
                <dd>{deriveRecommendedOption(contractor)}</dd>
              </div>
              <div>
                <dt>Written warranty</dt>
                <dd>{warrantySummary(contractor)}</dd>
              </div>
              <div>
                <dt>Questions remaining</dt>
                <dd>{deriveQuestionsRemaining(contractor)}</dd>
              </div>
              <div>
                <dt>Possible extra-cost risk</dt>
                <dd>{riskLabel(deriveExtraCostRisk(contractor))}</dd>
              </div>
              <div>
                <dt>Main result</dt>
                <dd>{deriveMainResult(contractor)}</dd>
              </div>
            </dl>

            <button type="button" className="btn secondary ec-card-button">
              View Details
            </button>

            {contractor.labels.length ? (
              <ul className="ec-label-list">
                {contractor.labels.map((label) => (
                  <li className="ec-label" key={label}>
                    {label}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
