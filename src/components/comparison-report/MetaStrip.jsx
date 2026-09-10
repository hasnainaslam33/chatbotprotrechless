import styles from './MetaStrip.module.css';

export default function MetaStrip({ preparedFor, address, reportDate, reportId }) {
  const items = [
    ['Prepared for', preparedFor],
    ['Service address', address],
    ['Report date', reportDate],
    ['Report ID', reportId]
  ];

  return <section className={styles.strip}>{items.map(([label, value]) => <div className={styles.item} key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>;
}