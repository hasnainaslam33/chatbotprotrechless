import styles from './StatusKey.module.css';

export default function StatusKey({ items }) { return <div className={styles.grid}>{items.map((item) => <div className={styles.item} key={item.label}><i style={{ backgroundColor: item.color }} /><div><strong>{item.label}</strong><span>{item.description}</span></div></div>)}</div>; }