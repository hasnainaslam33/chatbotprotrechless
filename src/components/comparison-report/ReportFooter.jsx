import styles from './ReportFooter.module.css';

export default function ReportFooter({ company, phone, email, website, disclaimer }) { return <footer className={styles.footer}>{disclaimer ? <p className={styles.disclaimer}>{disclaimer}</p> : null}<strong>{company}</strong><span>{phone} · {email} · {website}</span></footer>; }