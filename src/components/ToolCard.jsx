import { Link } from 'react-router-dom';

export default function ToolCard({ tool }) {
  const iconMap = {
    'symptom-checker': '🧭',
    'sewer-camera-review': '📹',
    'estimate-review': '📄',
    'free-second-opinion': '💬',
    'cost-estimator': '💵',
    'emergency-risk-check': '🚨'
  };

  return (
    <article className="tool-card">
      <div className="icon">{iconMap[tool.slug] || '🧰'}</div>
      <h3>{tool.title}</h3>
      <p>{tool.lead}</p>
      <Link className="small-link" to={`/tools/${tool.slug}`}>
        Open {tool.title}
      </Link>
    </article>
  );
}
