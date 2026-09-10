import styles from './ComparisonCards.module.css';

const riskClass = { Low: styles.low, Medium: styles.medium, High: styles.high };

function ownershipDisplay(value) {
  if (value === 'Ownership verified') return { className: styles.local, icon: '✓' };
  return { className: styles.unknown, icon: '?' };
}

export default function ComparisonCards({ items }) {
  return <section className={styles.grid}>{items.map((item) => <article className={`${styles.card} ${styles[item.accent]}`} key={item.name}>
    <h2>{item.name}</h2>
    <div className={styles.scoreLabel}>Proposal score</div><div className={styles.score}>{item.score}<small>/100</small></div>
    <dl>{[['Ownership & Accountability', <span className={`${styles.ownership} ${ownershipDisplay(item.ownership).className}`}><span className={styles.ownershipIcon} aria-hidden="true">{ownershipDisplay(item.ownership).icon}</span>{item.ownership}</span>], ['Price', item.price], ['Best value option', item.bestOption], ['Written warranty', item.warranty], ['Questions left', item.questionsLeft], ['Possible extra-cost risk', <span className={riskClass[item.risk]}>{item.risk}</span>]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className={styles.ribbon}>{item.ribbon}</div>
  </article>)}</section>;
}