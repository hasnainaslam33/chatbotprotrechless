import styles from './DataTable.module.css';

export default function DataTable({ columns, rows, statusColorFn, totals }) {
  return <div className={styles.scroll}><table><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || index}>{columns.map((column) => { const value = row[column.key]; const tone = statusColorFn ? statusColorFn(value, row, column.key) : ''; return <td className={tone ? styles[tone] : ''} key={column.key}>{value}</td>; })}</tr>)}{totals ? <tr className={styles.totals}>{columns.map((column) => <td key={column.key}>{totals[column.key]}</td>)}</tr> : null}</tbody></table></div>;
}