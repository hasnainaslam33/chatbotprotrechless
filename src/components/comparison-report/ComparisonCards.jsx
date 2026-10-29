import styles from './ComparisonCards.module.css';
import { CORPORATE_OWNERSHIP } from '../../lib/comparisonConfig.js';

const riskClass = { Low: styles.low, Medium: styles.medium, High: styles.high };

function ownershipDisplay(value) {
  if (value === 'Locally owned and operated') {
    return { className: styles.local, icon: '✓' };
  }
  if (CORPORATE_OWNERSHIP.includes(value)) {
    return { className: styles.corporate, icon: '⚠' };
  }
  if (value === 'Publicly traded (shareholder-owned)') {
    return { className: styles.publicCompany, icon: '↗' };
  }
  return { className: styles.unknown, icon: '?' };
}

export default function ComparisonCards({ items }) {
  const ownershipRows = [
    ['Local brand', 'localBrand'],
    ['Acquirer / platform', 'acquirerPlatform'],
    ['Current majority owner', 'currentMajorityOwner'],
    ['Prior PE owner', 'priorPeOwner']
  ];

  return <section className={styles.grid}>{items.map((item) => {
    const ownership = ownershipDisplay(item.ownership);
    const classificationInfo = (value, evidence) => {
      const sources = Array.isArray(evidence?.sources) ? evidence.sources : [];
      return <div className={styles.ownershipClaim}>
        <span>{value}</span>
        {evidence?.evidence ? <span className={styles.detailEvidence}>Evidence: {evidence.evidence}</span> : null}
        {evidence?.qualification ? <span className={styles.detailEvidence}>{evidence.qualification}</span> : null}
        {sources.length ? <ul className={styles.detailSources}>{sources.map((source) => (
          <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title || 'Source'}</a></li>
        ))}</ul> : null}
      </div>;
    };
    const rows = [
      ['Ownership & Accountability', <div className={`${styles.ownership} ${ownership.className}`}><span className={styles.ownershipIcon} aria-hidden="true">{ownership.icon}</span>{classificationInfo(item.ownership, item.ownershipEvidence)}</div>],
      ...ownershipRows.map(([label, key]) => {
        const claim = item.ownershipDetails?.[key] || {};
        const value = claim.value || 'Unable to verify';
        const claimSources = Array.isArray(claim.sources) ? claim.sources : [];
        return [label, <div className={styles.ownershipClaim}>
          <span className={claim.status === 'unverified' ? styles.unverified : ''}>{value}</span>
          {claim.eventDate ? <span className={styles.detailDate}>Event date: {claim.eventDate}</span> : null}
          {claim.evidence ? <span className={styles.detailEvidence}>Evidence: {claim.evidence}</span> : null}
          {claimSources.length ? <ul className={styles.detailSources}>{claimSources.map((source) => (
            <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title || 'Source'}</a></li>
          ))}</ul> : null}
        </div>];
      }),
      ['Price', item.price],
      ['Best value option', item.bestOption],
      ['Written warranty', item.warranty],
      ['Questions left', item.questionsLeft],
      ['Possible extra-cost risk', <span className={riskClass[item.risk]}>{item.risk}</span>]
    ];

    return <article className={`${styles.card} ${styles[item.accent]}`} key={item.name}>
      <h2>{item.name}</h2>
      <div className={styles.scoreLabel}>Proposal score</div><div className={styles.score}>{item.score}<small>/100</small></div>
      <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <div className={styles.ribbon}>{item.ribbon}</div>
    </article>;
  })}</section>;
}