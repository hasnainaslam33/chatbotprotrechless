import styles from './ResultBanner.module.css';

export default function ResultBanner({ tone, tag, title, body, highlight }) {
  return <section className={`${styles.banner} ${styles[tone]}`}><div className={styles.tag}>{tag}</div><div className={styles.content}><h2>{title}</h2><p>{body}</p><strong>{highlight}</strong></div></section>;
}