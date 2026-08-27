export default function Sidebar({ page }) {
  return (
    <aside className="sidebar" style={{ display: 'none' }}>
      <div className="panel sidebar-panel">
        <h3>Why this tool matters</h3>
        <p>{page.lead}</p>
      </div>
      <div className="panel sidebar-panel">
        <h3>Helpful links</h3>
        <ul className="sidebar-list">
          <li>
            <a href="https://protrenchless.com/sewer-camera-inspection/">Sewer camera inspection</a>
          </li>
          <li>
            <a href="https://protrenchless.com/trenchless-sewer-repair/">Trenchless repair options</a>
          </li>
          <li>
            <a href="https://protrenchless.com/sewer-repair/">Sewer repair planning</a>
          </li>
        </ul>
      </div>
    </aside>
  );
}
