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

/**
 * Three cards side by side on desktop, stacked on mobile.
 * No card is ever labelled "Winner" — labels describe documented properties.
 */
export default function ContractorSummaryCards({ contractors = [] }) {
  return (
    <section className="ec-section" aria-labelledby="ec-summary-heading">
      <h2 className="ec-section-title" id="ec-summary-heading">
        Your {contractors.length === 1 ? 'Estimate' : `${contractors.length} Estimates`} Compared
      </h2>
      <p className="mini ec-section-sub">
        Scores reflect what each contractor put in writing — not their reputation, and not their price.
      </p>

      <div className={`ec-contractor-grid ec-contractor-grid-${contractors.length}`}>
        {contractors.map((contractor) => (
          <article className="ec-contractor-card" key={contractor.id}>
            <header className="ec-contractor-head">
              <span className="ec-contractor-slot">Estimate {contractor.slot}</span>
              <h3 className="ec-contractor-name">{contractor.contractorName}</h3>
              {contractor.fileName ? (
                <span className="ec-contractor-file" title={contractor.fileName}>
                  {contractor.fileName}
                </span>
              ) : null}
            </header>

            <div className={`ec-score-block ec-score-${scoreTone(contractor.overallScore)}`}>
              <div className="ec-score-value">
                {contractor.overallScore}
                <span className="ec-score-max">/100</span>
              </div>
              <div className="ec-score-caption">Documentation score</div>
              <div className="ec-score-bar" role="img" aria-label={`Documentation score ${contractor.overallScore} out of 100`}>
                <span style={{ width: `${contractor.overallScore}%` }} />
              </div>
            </div>

            <dl className="ec-contractor-facts">
              <div>
                <dt>Total price</dt>
                <dd className="ec-fact-strong">{formatPrice(contractor.totalPrice)}</dd>
              </div>
              <div>
                <dt>Proposed method</dt>
                <dd>{contractor.proposedMethod || 'Not stated'}</dd>
              </div>
              <div>
                <dt>Warranty</dt>
                <dd>{warrantySummary(contractor)}</dd>
              </div>
            </dl>

            <div className="ec-contractor-counts">
              <span className="ec-count ec-count-warning">
                <strong>{contractor.warningCount}</strong> warnings
              </span>
              <span className="ec-count ec-count-neutral">
                <strong>{contractor.missingCount}</strong> not stated
              </span>
            </div>

            {contractor.labels.length ? (
              <ul className="ec-label-list">
                {contractor.labels.map((label) => (
                  <li className="ec-label" key={label}>
                    {label}
                  </li>
                ))}
              </ul>
            ) : null}

            {contractor.documentNotes ? <p className="ec-doc-note">{contractor.documentNotes}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
