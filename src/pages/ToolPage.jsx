import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ToolForm } from '../components/ToolForm.jsx';
import { LeadForm } from '../components/LeadForm.jsx';
import Sidebar from '../components/Sidebar.jsx';
import GuidedEstimateTool from '../components/estimate-comparison/GuidedEstimateTool.jsx';
import { toolPages } from '../data/toolPages.js';

export default function ToolPage() {
  const { slug } = useParams();
  const page = useMemo(() => toolPages.find((tool) => tool.slug === slug), [slug]);

  if (!page) {
    return (
      <main className="page tool-page">
        <section className="tool-hero">
          <div className="container">
            <span className="kicker">Powered by Pro Trenchless Services</span>
            <h1 className="h1-small">Tool not found</h1>
            <p className="lead">The requested tool could not be found. Return to the home page and choose a tool.</p>
            <Link className="btn" to="/">
              Back to home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page tool-page">
      <section className="tool-hero">
        <div className="container">
          <span className="kicker">Powered by Pro Trenchless Services</span>
          <h1 className="h1-small">{page.title}</h1>
          <p className="lead">{page.lead}</p>
        </div>
      </section>

      {/* The estimate comparison tool needs the full content width for its
          side-by-side tables, so it opts out of the two-column module layout. */}
      {page.component === 'estimate-comparison' ? (
        <section>
          <div className="container tool-full">
            <GuidedEstimateTool page={page} />
            <div className="stacked-panels" style={{ marginTop: '1.5rem' }}>
              <LeadForm />
            </div>
          </div>
        </section>
      ) : (
        <section>
          <div className="container module-layout">
            <ToolForm fields={page.fields} button={page.button} expectedOutput={page.expectedOutput} />
            <div className="stacked-panels">
              <Sidebar page={page} />
              <LeadForm />
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
