import { useRef, useState } from 'react';
import { acceptedUploadTypes, uploadStateMeta, UPLOAD_STATE } from '../../lib/comparisonConfig.js';

function UploadStatePill({ state }) {
  const meta = uploadStateMeta[state] || uploadStateMeta[UPLOAD_STATE.EMPTY];
  return (
    <span className={`ec-upload-state ec-upload-state-${meta.tone}`}>
      <span className="ec-upload-dot" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

function EstimateCard({ estimate, index, onFieldChange, onFileSelect, onClearFile }) {
  const inputRef = useRef(null);
  const [showPaste, setShowPaste] = useState(Boolean(estimate.pastedText));
  const busy = estimate.state === UPLOAD_STATE.UPLOADING;

  return (
    <div className={`ec-upload-card ec-upload-card-${estimate.state}`}>
      <div className="ec-upload-head">
        <h3 className="ec-upload-title">Estimate {index + 1}</h3>
        <UploadStatePill state={estimate.state} />
      </div>

      <div className="field ec-field">
        <label htmlFor={`contractor-name-${index}`}>Contractor name</label>
        <input
          id={`contractor-name-${index}`}
          type="text"
          value={estimate.contractorName}
          placeholder={`Example: Contractor ${index + 1}`}
          onChange={(event) => onFieldChange(index, 'contractorName', event.target.value)}
        />
      </div>

      <div className="field ec-field">
        <label htmlFor={`estimate-file-${index}`}>Estimate document</label>
        <input
          id={`estimate-file-${index}`}
          ref={inputRef}
          className="ec-file-input"
          type="file"
          accept={acceptedUploadTypes}
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFileSelect(index, file);
          }}
        />
        <button type="button" className="btn secondary ec-file-button" onClick={() => inputRef.current?.click()} disabled={busy}>
          {estimate.fileName ? 'Choose a different file' : 'Choose PDF, image, or document'}
        </button>

        {estimate.fileName ? (
          <div className="ec-file-chip">
            <span className="ec-file-name" title={estimate.fileName}>
              {estimate.fileName}
            </span>
            <button type="button" className="ec-file-remove" onClick={() => onClearFile(index)} aria-label={`Remove ${estimate.fileName}`}>
              Remove
            </button>
          </div>
        ) : (
          <span className="ec-hint">PDF, JPG, PNG, DOC, DOCX, or TXT.</span>
        )}

        {estimate.error ? <p className="ec-inline-error">{estimate.error}</p> : null}
      </div>

      <div className="field ec-field">
        <label htmlFor={`estimate-total-${index}`}>
          Estimate total <span className="ec-optional">optional</span>
        </label>
        <input
          id={`estimate-total-${index}`}
          type="text"
          inputMode="decimal"
          value={estimate.totalPrice}
          placeholder="Example: 14500"
          onChange={(event) => onFieldChange(index, 'totalPrice', event.target.value)}
        />
        <span className="ec-hint">Leave blank and we will read it from the document if it is printed there.</span>
      </div>

      <details className="ec-paste" open={showPaste} onToggle={(event) => setShowPaste(event.currentTarget.open)}>
        <summary>No file handy? Paste the estimate text instead</summary>
        <textarea
          className="ec-paste-input"
          rows={5}
          value={estimate.pastedText}
          placeholder="Paste the estimate wording here, exactly as written."
          onChange={(event) => onFieldChange(index, 'pastedText', event.target.value)}
        />
      </details>
    </div>
  );
}

export default function EstimateUploadStep({
  estimates,
  onFieldChange,
  onFileSelect,
  onClearFile,
  onBack,
  onAnalyze,
  readyCount,
  isUploading,
  formError
}) {
  return (
    <div className="ec-step-panel">
      <header className="ec-panel-head">
        <h2 className="ec-panel-title">Upload your estimates</h2>
        <p className="mini">
          One estimate works. <strong>Three gives you the clearest picture</strong> — differences between contractors are what reveal what a
          quote is quietly leaving out.
        </p>
      </header>

      <div className="ec-upload-grid">
        {estimates.map((estimate, index) => (
          <EstimateCard
            key={estimate.id}
            estimate={estimate}
            index={index}
            onFieldChange={onFieldChange}
            onFileSelect={onFileSelect}
            onClearFile={onClearFile}
          />
        ))}
      </div>

      {formError ? (
        <p className="ec-form-error" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="ec-step-actions">
        <button type="button" className="btn secondary" onClick={onBack}>
          Back to project details
        </button>
        <button type="button" className="btn" onClick={onAnalyze} disabled={isUploading || readyCount === 0}>
          Analyze My Estimates
        </button>
        <span className="mini">
          {readyCount === 0
            ? 'Add at least one estimate to continue.'
            : `${readyCount} estimate${readyCount === 1 ? '' : 's'} ready to analyze.`}
        </span>
      </div>
    </div>
  );
}
