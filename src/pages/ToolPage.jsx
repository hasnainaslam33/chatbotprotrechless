import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ToolForm } from '../components/ToolForm.jsx';
import { LeadForm } from '../components/LeadForm.jsx';
import Sidebar from '../components/Sidebar.jsx';
import GuidedEstimateTool from '../components/estimate-comparison/GuidedEstimateTool.jsx';
import { toolPages } from '../data/toolPages.js';

export default function ToolPage() {
  const { slug } = useParams();
  const page = useMemo(() => toolPages.find((tool) => tool.slug === slug), [slug]);
  const isSymptomChecker = slug === 'symptom-checker';
  const isCameraReview = slug === 'sewer-camera-review';
  const isFreeSecondOpinion = slug === 'free-second-opinion';
  const isCostEstimator = slug === 'cost-estimator';
  const isEmergencyRiskCheck = slug === 'emergency-risk-check';
  const isHomeInspectorSupport = slug === 'home-inspector-support';
  const isPropertyManagerTriage = slug === 'property-manager-drain-triage';
  const hasBottomLeadCta =
    isSymptomChecker ||
    isCameraReview ||
    isFreeSecondOpinion ||
    isCostEstimator ||
    isEmergencyRiskCheck ||
    isHomeInspectorSupport ||
    isPropertyManagerTriage;
  const hasLeadReviewModal = page?.component === 'estimate-comparison' || hasBottomLeadCta;
  const [isLeadFormOpen, setIsLeadFormOpen] = useState(false);
  const leadDialogRef = useRef(null);
  const leadTriggerRef = useRef(null);

  useEffect(() => {
    const dialog = leadDialogRef.current;
    if (!isLeadFormOpen || !dialog) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      leadTriggerRef.current?.focus();
    };
  }, [isLeadFormOpen]);

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
            <div className="lead-review-cta">
              <div>
                <span className="lead-review-eyebrow">Need a second opinion?</span>
                <h2>Get help reviewing your estimate</h2>
                <p>Share your details and our team can follow up about your project.</p>
              </div>
              <button
                className="btn"
                type="button"
                ref={leadTriggerRef}
                onClick={() => setIsLeadFormOpen(true)}
              >
                Request a professional review
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section>
          <div className={`container module-layout${hasBottomLeadCta ? ' bottom-lead-layout' : ''}`}>
            <ToolForm
              key={slug}
              fields={page.fields}
              button={page.button}
              expectedOutput={page.expectedOutput}
              className={
                isCameraReview ||
                isFreeSecondOpinion ||
                isCostEstimator ||
                isEmergencyRiskCheck ||
                isHomeInspectorSupport ||
                isPropertyManagerTriage
                  ? `two-column-intake-form${isEmergencyRiskCheck ? ' emergency-risk-form' : ''}`
                  : ''
              }
            />
            {!hasBottomLeadCta ? (
              <div className="stacked-panels">
                <Sidebar page={page} />
                <LeadForm />
              </div>
            ) : null}
            {hasBottomLeadCta ? (
              <div className="lead-review-cta">
                <div>
                  <span className="lead-review-eyebrow">
                    {isSymptomChecker
                      ? 'Need help with your symptoms?'
                      : isCameraReview
                        ? 'Need a second opinion?'
                        : isCostEstimator
                          ? 'Need a more accurate project estimate?'
                          : isEmergencyRiskCheck
                            ? 'Need urgent help with a sewer backup?'
                            : isHomeInspectorSupport
                              ? 'Need help reviewing a sewer scope?'
                              : isPropertyManagerTriage
                                ? 'Need help with a tenant drain issue?'
                          : 'Need help with your sewer project?'}
                  </span>
                  <h2>
                    {isSymptomChecker
                      ? 'Get help reviewing your sewer symptoms'
                      : isCameraReview
                        ? 'Get help reviewing your camera footage'
                        : isFreeSecondOpinion
                          ? 'Get a professional sewer second opinion'
                          : isCostEstimator
                            ? 'Get help estimating your sewer repair'
                            : isHomeInspectorSupport
                              ? 'Get professional help reviewing your sewer scope'
                              : isPropertyManagerTriage
                                ? 'Get help triaging your property drain issue'
                            : 'Talk with a sewer professional about the backup'}
                  </h2>
                  <p>Share your details and our team can follow up about your project.</p>
                </div>
                <button
                  className="btn"
                  type="button"
                  ref={leadTriggerRef}
                  onClick={() => setIsLeadFormOpen(true)}
                >
                  Request a professional review
                </button>
              </div>
            ) : null}
          </div>
        </section>
      )}
      {hasLeadReviewModal && isLeadFormOpen ? (
        <dialog
          className="lead-review-dialog"
          ref={leadDialogRef}
          aria-label={
            isSymptomChecker
              ? 'Request a professional symptom review'
              : isCameraReview
                ? 'Request a professional camera review'
                : isFreeSecondOpinion
                  ? 'Request a professional sewer second opinion'
                  : isCostEstimator
                    ? 'Request a professional cost estimate'
                    : isEmergencyRiskCheck
                      ? 'Request emergency sewer assistance'
                      : isHomeInspectorSupport
                        ? 'Request a professional sewer scope review'
                        : isPropertyManagerTriage
                          ? 'Request property manager drain support'
                      : 'Request a professional estimate review'
          }
          onCancel={(event) => {
            event.preventDefault();
            setIsLeadFormOpen(false);
          }}
          onClose={() => setIsLeadFormOpen(false)}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsLeadFormOpen(false);
          }}
        >
          <button
            className="lead-review-close"
            type="button"
            aria-label="Close review request form"
            onClick={() => setIsLeadFormOpen(false)}
          >
            <span aria-hidden="true">&times;</span>
          </button>
          <LeadForm />
        </dialog>
      ) : null}
    </main>
  );
}
