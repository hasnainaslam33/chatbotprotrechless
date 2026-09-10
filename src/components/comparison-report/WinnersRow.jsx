import styles from './WinnersRow.module.css';

export default function WinnersRow({ items }) { return <section className={styles.grid}>{items.map((item) => <article className={styles.item} key={item.label}><span>{item.label}</span><strong>{item.name}</strong><p>{item.detail}</p></article>)}</section>; }