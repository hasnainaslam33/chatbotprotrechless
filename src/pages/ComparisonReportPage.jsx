import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ComparisonReportResult from '../components/comparison-report/ComparisonReportResult.jsx';
import { LeadForm } from '../components/LeadForm.jsx';
import { normalizeAnalysis } from '../lib/normalizeAnalysis.js';
import { toolPages } from '../data/toolPages.js';
import '../styles/estimate-comparison.css';

const TOOL_SLUG = 'estimate-review';

/**
 * Reopens a saved comparison from its shareable link. It renders the same
 * ComparisonReportResult the homeowner saw right after the analysis, so a reload
 * (or a link opened elsewhere) shows an identical layout.
 */
export default function ComparisonReportPage() {
  const { reportId, token } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const page = toolPages.find((tool) => tool.slug === TOOL_SLUG);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    async function load() {
      try {
        const response = await fetch(`/api/estimate-comparison/report/${encodeURIComponent(reportId)}/${encodeURIComponent(token)}`);
        if (!response.ok) throw new Error('This comparison could not be found. The link may be incorrect or incomplete.');
        const data = await response.json();
        if (active) setReport(normalizeAnalysis(data));
      } catch (loadError) {
        if (active) setError(loadError.message || 'This comparison could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [reportId, token]);

  return (
    <main className="page tool-page">
      <section className="tool-hero">
        <div className="container">
          <span className="kicker">Powered by Pro Trenchless Services</span>
          <h1 className="h1-small">{page?.title || 'Estimate Comparison'}</h1>
          <p className="lead">{page?.lead}</p>
        </div>
      </section>

      <section>
        <div className="container tool-full">
          <div className="panel ec-tool">
            {loading ? (
              <>
                <h2>Loading your comparison</h2>
                <p className="mini">Please wait while the secure report is retrieved.</p>
              </>
            ) : null}

            {!loading && error ? (
              <>
                <h2>Comparison not available</h2>
                <p className="ec-form-error">{error}</p>
                <Link className="btn" to={`/tools/${TOOL_SLUG}`}>Start a new comparison</Link>
              </>
            ) : null}

            {!loading && report ? (
              <ComparisonReportResult analysis={report} onStartOver={() => navigate(`/tools/${TOOL_SLUG}`)} />
            ) : null}
          </div>
          <div className="stacked-panels" style={{ marginTop: '1.5rem' }}>
            <LeadForm />
          </div>
        </div>
      </section>
    </main>
  );
}
