import styles from './PageTitle.module.css';

export default function PageTitle({ title, subtitle }) {
  return <div className={styles.title}><h1>{title}</h1><div className={styles.rule} /><p>{subtitle}</p></div>;
}