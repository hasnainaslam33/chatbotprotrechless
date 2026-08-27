import { useMemo, useRef, useState } from 'react';
import { MAX_ESTIMATES, projectBasicsDefaults, UPLOAD_STATE } from '../../lib/comparisonConfig.js';
import { assignLabels, buildContractor, buildContractorQuestions, buildFallbackSummary, buildKeyQuestionMatrix, topRisks } from '../../lib/comparisonScoring.js';
import AnalysisLoadingState from './AnalysisLoadingState.jsx';
import EstimateUploadStep from './EstimateUploadStep.jsx';
import IntakeStepper from './IntakeStepper.jsx';
import ProjectBasicsStep from './ProjectBasicsStep.jsx';
import ResultsDashboard from './ResultsDashboard.jsx';
import '../../styles/estimate-comparison.css';

const MODULE_KEY = 'estimate-review';

const STEPS = [
  { id: 'basics', title: 'Project basics', subtitle: 'All optional' },
  { id: 'uploads', title: 'Upload estimates', subtitle: 'Up to three' },
  { id: 'results', title: 'Compare', subtitle: 'After analysis' }
];

const PHASE = { INTAKE: 'intake', ANALYZING: 'analyzing', RESULTS: 'results' };

function emptyEstimate(index) {
  return {
    id: `estimate-${index + 1}`,
    contractorName: '',
    totalPrice: '',
    pastedText: '',
    fileName: '',
    uploadedFileIds: [],
    state: UPLOAD_STATE.EMPTY,
    error: ''
  };
}

/**
 * Three-Quote Sewer Estimate Comparison Tool.
 *
 * Progressive disclosure by design: the homeowner sees project basics, then
 * uploads, then analysis. The ~260 comparison fields are never shown as a form —
 * they are extracted from the documents and only surface in the results.
 */
export default function GuidedEstimateTool({ page }) {
  const [phase, setPhase] = useState(PHASE.INTAKE);
  const [step, setStep] = useState(0);
  const [basics, setBasics] = useState(projectBasicsDefaults);
  const [estimates, setEstimates] = useState(() => Array.from({ length: MAX_ESTIMATES }, (_, index) => emptyEstimate(index)));
  const [analysis, setAnalysis] = useState(null);
  const [formError, setFormError] = useState('');
  const resultsRef = useRef(null);

  const isUploading = estimates.some((estimate) => estimate.state === UPLOAD_STATE.UPLOADING);

  const readyEstimates = useMemo(
    () => estimates.filter((estimate) => estimate.uploadedFileIds.length > 0 || estimate.pastedText.trim().length > 0),
    [estimates]
  );

  function updateEstimate(index, patch) {
    setEstimates((current) => current.map((estimate, i) => (i === index ? { ...estimate, ...patch } : estimate)));
  }

  function handleBasicsChange(name, value) {
    setBasics((current) => ({ ...current, [name]: value }));
  }

  function handleEstimateFieldChange(index, name, value) {
    updateEstimate(index, { [name]: value });
    if (formError) setFormError('');
  }

  async function handleFileSelect(index, file) {
    updateEstimate(index, { state: UPLOAD_STATE.UPLOADING, fileName: file.name, error: '' });
    setFormError('');

    const body = new FormData();
    body.append('files', file);
    body.append('module', MODULE_KEY);
    body.append('userType', readUserType());
    body.append('sourcePage', typeof window !== 'undefined' ? window.location.pathname : '');

    try {
      const response = await fetch('/api/uploads', { method: 'POST', body });
      const text = await response.text();
      let data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("We couldn't read this estimate. Try uploading a clearer PDF or image.");
        }
      }

      if (!response.ok) {
        throw new Error(friendlyUploadError(data?.error, response.status));
      }

      const fileIds = (data.files || []).map((item) => item.id).filter(Boolean);
      if (!fileIds.length) throw new Error("We couldn't read this estimate. Try uploading a clearer PDF or image.");

      updateEstimate(index, { state: UPLOAD_STATE.UPLOADED, uploadedFileIds: fileIds, error: '' });
    } catch (error) {
      updateEstimate(index, {
        state: UPLOAD_STATE.ERROR,
        uploadedFileIds: [],
        error: error.message || "We couldn't upload this file. Please try again."
      });
    }
  }

  function handleClearFile(index) {
    updateEstimate(index, { fileName: '', uploadedFileIds: [], state: UPLOAD_STATE.EMPTY, error: '' });
  }

  async function handleAnalyze() {
    if (!readyEstimates.length) {
      setFormError('Please upload at least one contractor estimate to continue.');
      return;
    }

    setFormError('');
    setPhase(PHASE.ANALYZING);
    setEstimates((current) =>
      current.map((estimate) =>
        estimate.uploadedFileIds.length || estimate.pastedText.trim() ? { ...estimate, state: UPLOAD_STATE.PROCESSING } : estimate
      )
    );

    try {
      const response = await fetch('/api/estimate-comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userType: readUserType(),
          projectBasics: basics,
          estimates: readyEstimates.map((estimate, index) => ({
            contractorName: estimate.contractorName || `Contractor ${index + 1}`,
            uploadedFileIds: estimate.uploadedFileIds,
            pastedText: estimate.pastedText,
            totalPrice: estimate.totalPrice
          }))
        })
      });

      const text = await response.text();
      let data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error('The analysis came back in an unexpected format. Please try again.');
        }
      }

      if (!response.ok) {
        throw new Error(data?.error || 'We could not analyze these estimates right now. Please try again in a moment.');
      }

      setAnalysis(normalizeAnalysis(data));
      setEstimates((current) =>
        current.map((estimate) =>
          estimate.state === UPLOAD_STATE.PROCESSING ? { ...estimate, state: UPLOAD_STATE.COMPLETE } : estimate
        )
      );
      setStep(2);
      setPhase(PHASE.RESULTS);
      window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } catch (error) {
      setFormError(error.message || 'We could not analyze these estimates right now. Please try again in a moment.');
      setEstimates((current) =>
        current.map((estimate) =>
          estimate.state === UPLOAD_STATE.PROCESSING
            ? { ...estimate, state: estimate.uploadedFileIds.length ? UPLOAD_STATE.UPLOADED : UPLOAD_STATE.EMPTY }
            : estimate
        )
      );
      setPhase(PHASE.INTAKE);
      setStep(1);
    }
  }

  function handleStartOver() {
    setAnalysis(null);
    setEstimates(Array.from({ length: MAX_ESTIMATES }, (_, index) => emptyEstimate(index)));
    setBasics(projectBasicsDefaults);
    setFormError('');
    setStep(0);
    setPhase(PHASE.INTAKE);
  }

  return (
    <div className="panel ec-tool" ref={resultsRef}>
      <header className="ec-tool-head">
        <h2>{page?.button?.panelHeading || 'Guided estimate comparison'}</h2>
        <p className="mini">
          {page?.button?.panelSubheading ||
            'Upload up to three sewer estimates and see exactly what each one covers, excludes, and leaves unsaid — scored against the same criteria.'}
        </p>
      </header>

      <IntakeStepper steps={STEPS} currentStep={step} onStepSelect={(index) => (phase === PHASE.INTAKE ? setStep(index) : undefined)} />

      {phase === PHASE.INTAKE && step === 0 ? (
        <ProjectBasicsStep values={basics} onChange={handleBasicsChange} onNext={() => setStep(1)} />
      ) : null}

      {phase === PHASE.INTAKE && step === 1 ? (
        <EstimateUploadStep
          estimates={estimates}
          onFieldChange={handleEstimateFieldChange}
          onFileSelect={handleFileSelect}
          onClearFile={handleClearFile}
          onBack={() => setStep(0)}
          onAnalyze={handleAnalyze}
          readyCount={readyEstimates.length}
          isUploading={isUploading}
          formError={formError}
        />
      ) : null}

      {phase === PHASE.ANALYZING ? (
        <AnalysisLoadingState contractorNames={readyEstimates.map((estimate, index) => estimate.contractorName || `Contractor ${index + 1}`)} />
      ) : null}

      {phase === PHASE.RESULTS && analysis ? <ResultsDashboard analysis={analysis} onStartOver={handleStartOver} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function readUserType() {
  if (typeof window === 'undefined') return 'Homeowner';
  return window.localStorage.getItem('pt_user_type') || 'Homeowner';
}

function friendlyUploadError(serverError = '', status = 0) {
  const raw = String(serverError || '');
  if (/Unsupported file type/i.test(raw)) return 'That file type is not supported. Please upload a PDF, JPG, PNG, DOC, DOCX, or TXT file.';
  if (/File too large|LIMIT_FILE_SIZE/i.test(raw)) return 'That file is too large. Please upload a smaller PDF or image.';
  if (status === 403) return 'File uploads are currently unavailable. You can paste the estimate text instead.';
  return raw || "We couldn't upload this file. Please try again.";
}

/**
 * The server already returns fully-scored contractors using the same shared
 * modules the UI imports. This rebuilds anything missing so the dashboard can
 * never receive a half-shaped payload — e.g. if an older server is deployed.
 */
function normalizeAnalysis(data = {}) {
  const hasScores = Array.isArray(data.contractors) && data.contractors.every((contractor) => Array.isArray(contractor.groupScores));

  const contractors = hasScores
    ? data.contractors
    : assignLabels((data.contractors || []).map((contractor, index) => buildContractor(contractor, index)));

  return {
    contractors,
    risks: Array.isArray(data.risks) && data.risks.length ? data.risks : topRisks(contractors, [], 5),
    keyQuestions: Array.isArray(data.keyQuestions) && data.keyQuestions.length ? data.keyQuestions : buildKeyQuestionMatrix(contractors),
    contractorQuestions:
      Array.isArray(data.contractorQuestions) && data.contractorQuestions.length
        ? data.contractorQuestions
        : buildContractorQuestions(contractors),
    summary: data.summary || buildFallbackSummary(contractors),
    disclaimer: data.disclaimer || '',
    mode: data.mode || ''
  };
}
