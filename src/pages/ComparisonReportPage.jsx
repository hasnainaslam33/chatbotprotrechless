import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

const FALLBACK_DEMO = {
  customer: {
    customerName: 'Customer Name',
    streetAddress: 'Street Address',
    city: 'City',
    state: 'State',
    zipCode: 'ZIP'
  },
  reportId: 'REPORT-0001',
  reportDate: new Date().toISOString(),
  contractors: [
    { id: 'c1', contractorName: 'Company 1', overallScore: 91, totalPrice: 11900, proposedMethod: 'Better - $11,900', warranty: '25 years parts + labor', questionsRemaining: 2, extraCostRisk: 'LOW', labels: ['Strongest written warranty'], documentNotes: 'Clear scope and documentation.' },
    { id: 'c2', contractorName: 'Company 2', overallScore: 85, totalPrice: 14600, proposedMethod: 'Best - $14,600', warranty: 'Lifetime product limited', questionsRemaining: 4, extraCostRisk: 'MEDIUM', labels: ['Strongest warranty'], documentNotes: 'Strong warranty but more questions.' },
    { id: 'c3', contractorName: 'Company 3', overallScore: 73, totalPrice: 9500, proposedMethod: 'Good - $9,500', warranty: '5 years limited', questionsRemaining: 6, extraCostRisk: 'HIGH', labels: ['Lowest stated price'], documentNotes: 'Lower price but more risk.' }
  ]
};

function formatPrice(value) {
  if (!Number.isFinite(value) || value <= 0) return 'Not stated';
  return `$${Number(value).toLocaleString()}`;
}

function scoreTone(score) {
  if (score >= 80) return 'positive';
  if (score >= 60) return 'warning';
  return 'neutral';
}

function ownershipStatus(company) {
  const license = company.fields?.find((field) => field.key === 'license_number');
  if (license?.value) return { className: 'is-local', icon: '✓', label: 'Ownership verified' };
  return { className: 'is-unknown', icon: '?', label: 'Ownership not verified' };
}

export default function ComparisonReportPage() {
  const { reportId, token } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch(`/api/estimate-comparison/report/${reportId}/${token}`);
        if (!response.ok) {
          throw new Error('This comparison could not be loaded.');
        }
        const data = await response.json();
        if (active) setReport(data);
      } catch (loadError) {
        if (active) {
          setError(loadError.message || 'This comparison could not be loaded.');
          setReport(FALLBACK_DEMO);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [reportId, token]);

  const comparison = report || FALLBACK_DEMO;
  const customer = comparison.customer || FALLBACK_DEMO.customer;
  const companies = comparison.contractors || FALLBACK_DEMO.contractors;
  const serviceAddress = useMemo(() => {
    const parts = [customer.streetAddress, customer.city, customer.state, customer.zipCode].filter(Boolean);
    return parts.join(', ');
  }, [customer]);
  const scoreRows = [
    { label: 'Work Details', value: 28, total: 30 },
    { label: 'Price Clarity', value: 18, total: 20 },
    { label: 'Warranty', value: 17, total: 20 },
    { label: 'Proof After Work', value: 14, total: 15 },
    { label: 'Customer Protection', value: 14, total: 15 }
  ];

  const winners = [
    { label: 'Best overall value', value: companies[0]?.contractorName || 'Company 1' },
    { label: 'Lowest stated price', value: companies.slice().sort((a, b) => (a.totalPrice || Infinity) - (b.totalPrice || Infinity))[0]?.contractorName || 'Company 3' },
    { label: 'Strongest written warranty', value: companies.slice().sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0))[0]?.contractorName || 'Company 1' },
    { label: 'Fewest questions', value: companies[0]?.contractorName || 'Company 1' },
    { label: 'Lowest extra-cost risk', value: companies[0]?.contractorName || 'Company 1' }
  ];

  if (loading) {
    return (
      <main className="page tool-page">
        <section className="container ec-report-viewport">
          <div className="panel ec-tool">
            <h2>Loading your comparison</h2>
            <p className="mini">Please wait while the secure report is retrieved.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page tool-page ec-proposal-page">
      <section className="container ec-report-viewport">
        <div className="ec-brand-header">
          <div className="ec-brand-lockup" aria-label="Pro Trenchless logo">
            <div className="ec-brand-circle">
              <span>PRO</span>
              <span>TRENCHLESS</span>
            </div>
          </div>
          <nav className="ec-brand-nav" aria-label="Primary navigation">
            <a href="#">Home</a>
            <a href="#">Symptom Checker</a>
            <a href="#">Estimate Review</a>
            <a href="#">Camera Review</a>
          </nav>
          <a href="tel:4842065551" className="ec-call-button">Call (484) 206-5551</a>
        </div>

        <div className="panel ec-tool ec-report-shell">
          {error ? <p className="ec-form-error">{error}</p> : null}

          <header className="ec-report-header">
            <div>
              <span className="ec-report-badge">Proposal Review</span>
              <h1 className="ec-panel-title ec-report-title">YOUR THREE COMPANIES COMPARED</h1>
              <p className="mini ec-report-subtitle">Each company is scored using the same 100-point system.</p>
            </div>
          </header>

          <div className="ec-report-meta">
            <div className="ec-meta-box">
              <span className="ec-meta-label">Prepared for</span>
              <strong>{customer.customerName}</strong>
            </div>
            <div className="ec-meta-box">
              <span className="ec-meta-label">Service address</span>
              <strong>{serviceAddress}</strong>
            </div>
            <div className="ec-meta-box">
              <span className="ec-meta-label">Report date</span>
              <strong>{new Date(comparison.reportDate || Date.now()).toLocaleDateString()}</strong>
            </div>
            <div className="ec-meta-box">
              <span className="ec-meta-label">Report ID</span>
              <strong>{comparison.reportId || reportId}</strong>
            </div>
          </div>

          <div className="ec-contractor-grid ec-contractor-grid-3">
            {companies.map((company) => (
              <article key={company.id} className="ec-contractor-card">
                <div className="ec-contractor-topline">
                  <span className="ec-contractor-slot">Company</span>
                  <span className="ec-company-rank">#{company.id?.replace('c', '') || '1'}</span>
                </div>
                <h3 className="ec-contractor-name">{company.contractorName}</h3>

                <div className={`ec-score-block ec-score-${scoreTone(company.overallScore || 0)}`}>
                  <div className="ec-score-title">Overall Proposal Score</div>
                  <div className="ec-score-value">
                    {company.overallScore || 0}
                    <span className="ec-score-max">/100</span>
                  </div>
                  <p className="ec-score-caption">
                    This score evaluates the written proposal, price clarity, warranty, proof of work, and customer protections. It does not predict contractor workmanship.
                  </p>
                  <div className="ec-score-bar" aria-label={`Overall proposal score ${company.overallScore || 0} out of 100`}>
                    <span style={{ width: `${company.overallScore || 0}%` }} />
                  </div>
                </div>

                <dl className="ec-contractor-facts">
                  <div>
                    <dt>Ownership &amp; Accountability</dt>
                    <dd>
                      {(() => {
                        const ownership = ownershipStatus(company);
                        return (
                          <span className={`ec-ownership-status ${ownership.className}`}>
                            <span className="ec-ownership-icon" aria-hidden="true">{ownership.icon}</span>
                            <span>{ownership.label}</span>
                          </span>
                        );
                      })()}
                    </dd>
                  </div>
                  <div>
                    <dt>Price</dt>
                    <dd>{formatPrice(company.totalPrice)}</dd>
                  </div>
                  <div>
                    <dt>Recommended option</dt>
                    <dd>{company.proposedMethod || 'Not stated'}</dd>
                  </div>
                  <div>
                    <dt>Written warranty</dt>
                    <dd>{company.warranty || 'Not stated'}</dd>
                  </div>
                  <div>
                    <dt>Questions remaining</dt>
                    <dd>{company.questionsRemaining ?? 0}</dd>
                  </div>
                  <div>
                    <dt>Possible extra-cost risk</dt>
                    <dd>{company.extraCostRisk || 'LOW'}</dd>
                  </div>
                  <div>
                    <dt>Main result</dt>
                    <dd>{company.labels?.[0] || 'Documentation review completed'}</dd>
                  </div>
                </dl>

                <button type="button" className="btn secondary ec-card-button">
                  View Details
                </button>
              </article>
            ))}
          </div>

          <section className="ec-section">
            <h2 className="ec-section-title">OTHER IMPORTANT WINNERS</h2>
            <p className="mini ec-section-sub">These are category winners based on the written proposal, not absolute contractor quality claims.</p>
            <div className="ec-winner-grid">
              {winners.map((winner) => (
                <div key={winner.label} className="ec-winner-card">
                  <span>{winner.label}</span>
                  <strong>{winner.value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="ec-section">
            <h2 className="ec-section-title">HOW THE SCORE WAS BUILT</h2>
            <div className="ec-score-breakdown-layout">
              <div className="ec-breakdown-panel">
                <div className="ec-breakdown-row ec-breakdown-header">
                  <span>Category</span>
                  <span>Points</span>
                </div>
                {scoreRows.map((row) => (
                  <div key={row.label} className="ec-breakdown-row">
                    <span>{row.label}</span>
                    <span>{row.value}/{row.total}</span>
                  </div>
                ))}
                <div className="ec-breakdown-row ec-breakdown-total">
                  <span>Total</span>
                  <span>91/100</span>
                </div>
              </div>

              <aside className="ec-score-summary-card">
                <span className="ec-meta-label">Top result</span>
                <div className="ec-score-summary-value">91</div>
                <p>SafeLine Better ranked highest because the written proposal gives the best balance of clear work, price protection, permits, yard repair, camera proof, written records, and parts-and-labor coverage.</p>
              </aside>
            </div>
          </section>

          <section className="ec-section">
            <h2 className="ec-section-title">GOOD / BETTER / BEST</h2>
            <div className="ec-options-grid ec-options-grid-3">
              {companies.map((company) => (
                <div key={`${company.id}-options`} className="ec-options-column">
                  <h3 className="ec-subsection-title">{company.contractorName}</h3>
                  <article className="ec-option-card">
                    <div className="ec-option-header">
                      <span className="ec-option-tier">Good</span>
                      <strong>Basic Repair</strong>
                      <span className="ec-option-price">{formatPrice(company.totalPrice)}</span>
                    </div>
                    <dl className="ec-option-facts">
                      <div><dt>What’s included</dt><dd>Standard work scope and basic proposal documentation</dd></div>
                      <div><dt>What’s not included</dt><dd>Permit fees, restoration, and some customer protections</dd></div>
                      <div><dt>Warranty</dt><dd>{company.warranty || 'Not stated'}</dd></div>
                      <div><dt>Important protections</dt><dd>Limited customer protection language</dd></div>
                      <div><dt>Possible extra costs</dt><dd>{company.extraCostRisk === 'HIGH' ? 'Restoration, permit fees, access, and rock' : 'Possible restoration or access fees'}</dd></div>
                      <div><dt>Questions to ask</dt><dd>Is the warranty transferable? Are permits included?</dd></div>
                    </dl>
                  </article>
                </div>
              ))}
            </div>
          </section>

          <section className="ec-section">
            <h2 className="ec-section-title">WARRANTY COMPARISON</h2>
            <div className="ec-highlight-grid ec-highlight-grid-3">
              {companies.map((company) => (
                <div key={`${company.id}-warranty`} className="ec-highlight-card">
                  <strong>{company.contractorName}</strong>
                  <span className="ec-status ec-status-positive">CLEARLY INCLUDED</span>
                  <p className="ec-highlight-value">{company.warranty || 'Warranty details not stated in the proposal.'}</p>
                  <p className="ec-evidence-empty">A lifetime product warranty may cover only the pipe material and may not pay for labor, excavation, restoration, or a failed connection.</p>
                </div>
              ))}
            </div>
          </section>

          <section className="ec-section">
            <h2 className="ec-section-title">SERVICE GUARANTEES</h2>
            <div className="ec-highlight-grid ec-highlight-grid-3">
              {companies.map((company) => (
                <div key={`${company.id}-guarantee`} className="ec-highlight-card">
                  <strong>{company.contractorName}</strong>
                  <span className="ec-status ec-status-warning">MENTIONED - TERMS UNCLEAR</span>
                  <p className="ec-highlight-value">The proposal mentions customer satisfaction, but the time limit, remedy, and exclusions are not clearly stated.</p>
                </div>
              ))}
            </div>
          </section>

          <section className="ec-section">
            <h2 className="ec-section-title">POSSIBLE EXTRA-COST RISK</h2>
            <div className="ec-highlight-grid ec-highlight-grid-3">
              {companies.map((company) => (
                <div key={`${company.id}-risk`} className="ec-highlight-card">
                  <strong>{company.contractorName}</strong>
                  <span className={`ec-status ${company.extraCostRisk === 'HIGH' ? 'ec-status-negative' : company.extraCostRisk === 'MEDIUM' ? 'ec-status-warning' : 'ec-status-positive'}`}>
                    {company.extraCostRisk || 'LOW'}
                  </span>
                  <p className="ec-highlight-value">
                    {company.extraCostRisk === 'HIGH'
                      ? 'Several important costs are not addressed in the written proposal.'
                      : company.extraCostRisk === 'MEDIUM'
                        ? 'Some possible additional costs are mentioned but the pricing is not fully clear.'
                        : 'Most common project costs are clearly addressed.'}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="ec-section">
            <h2 className="ec-section-title">YOUR FINAL RESULT</h2>
            <div className="ec-final-result">
              <div>
                <p className="ec-final-label">Best documented company</p>
                <strong>Company 1</strong>
              </div>
              <div>
                <p className="ec-final-label">Best documented option</p>
                <strong>Better - $11,900</strong>
              </div>
              <div>
                <p className="ec-final-label">Lowest stated price</p>
                <strong>Company 3</strong>
              </div>
              <div>
                <p className="ec-final-label">Strongest written warranty</p>
                <strong>Company 1</strong>
              </div>
            </div>
            <p className="ec-summary-body ec-summary-note">
              Company 1 ranked highest because the written proposal gives the best balance of clear work, price protection, permits, yard repair, camera proof, written records, and parts-and-labor coverage.
            </p>
          </section>

          <section className="ec-section ec-cta-panel">
            <h2 className="ec-section-title">WOULD YOU LIKE THE PIPE CHECKED BEFORE YOU DECIDE?</h2>
            <p className="mini ec-section-sub">A proposal tells you what a company plans to do. A sewer camera can help show what is really happening inside the pipe.</p>
            <ul className="ec-cta-list">
              <li>See where the problem is</li>
              <li>Check how much pipe is affected</li>
              <li>See whether the proposed repair matches the visible problem</li>
              <li>Ask whether a smaller or less disruptive repair may work</li>
            </ul>
            <div className="ec-step-actions">
              <a className="btn" href="https://answers.protrenchless.com/#lead-form">REQUEST A FREE CAMERA INSPECTION</a>
            </div>
          </section>

          <div className="ec-transparency-note">
            <strong>Important note:</strong> “Not stated” does not mean the company will not provide the item. It means the item was not clearly written in the proposal we reviewed. The customer should confirm important items in writing before signing.
          </div>
        </div>
      </section>
    </main>
  );
}
