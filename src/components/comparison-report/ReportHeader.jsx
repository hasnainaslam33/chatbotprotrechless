import styles from './ReportHeader.module.css';

export default function ReportHeader({ company, badge }) {
  const [accent, ...rest] = company.name.split(' ');

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div>
          <div className={styles.company}><span>{accent}</span> {rest.join(' ')}</div>
          <div className={styles.tagline}>{company.tagline}</div>
        </div>
        <div className={styles.badge}>
          <strong>{badge.stat}</strong>
          <b>{badge.caption}</b>
          <span>{badge.label}</span>
        </div>
      </div>
    </header>
  );
}