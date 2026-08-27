import { useEffect, useState } from 'react';

const PHASES = [
  'Reading each estimate document',
  'Extracting scope, exclusions, and warranty wording',
  'Checking what is written versus what is missing',
  'Scoring every estimate against the same criteria',
  'Building your comparison'
];

/**
 * Progress + skeleton state. The phase ticker is indicative pacing, not a real
 * server progress feed — it never claims a step finished that we cannot observe.
 */
export default function AnalysisLoadingState({ contractorNames = [] }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase((current) => (current < PHASES.length - 1 ? current + 1 : current));
    }, 4200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="ec-loading" role="status" aria-live="polite">
      <div className="ec-loading-head">
        <span className="ec-spinner" aria-hidden="true" />
        <div>
          <h2 className="ec-panel-title">Analyzing your estimates</h2>
          <p className="mini">
            Reading {contractorNames.length} document{contractorNames.length === 1 ? '' : 's'}. This usually takes under a minute.
          </p>
        </div>
      </div>

      <ol className="ec-loading-phases">
        {PHASES.map((label, index) => (
          <li key={label} className={index <= phase ? 'is-active' : ''}>
            <span aria-hidden="true">{index < phase ? '✓' : index === phase ? '•' : '○'}</span>
            {label}
          </li>
        ))}
      </ol>

      <div className="ec-skeleton-grid">
        {contractorNames.map((name, index) => (
          <div className="ec-skeleton-card" key={`${name}-${index}`}>
            <div className="ec-skeleton-line ec-skeleton-title" />
            <div className="ec-skeleton-line" />
            <div className="ec-skeleton-line ec-skeleton-short" />
            <div className="ec-skeleton-line" />
          </div>
        ))}
      </div>
    </div>
  );
}
