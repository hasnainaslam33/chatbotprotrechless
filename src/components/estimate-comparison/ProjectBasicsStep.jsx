import { customerProfileFields } from '../../lib/comparisonConfig.js';

/**
 * Step 1 collects the customer details required before a comparison can be generated.
 */
export default function ProjectBasicsStep({ values, onChange, onNext, formError, isSaving = false }) {
  return (
    <div className="ec-step-panel">
      <header className="ec-panel-head">
        <h2 className="ec-panel-title">Customer details</h2>
        <p className="mini">
          We need the customer name and service address before we can create the comparison.
        </p>
      </header>

      <div className="ec-customer-grid">
        {customerProfileFields.map((field) => (
          <div className="field ec-field" key={field.name}>
            <label htmlFor={`basics-${field.name}`}>
              {field.label}
              {field.required ? <span className="ec-required"> *</span> : <span className="ec-optional">optional</span>}
            </label>

            {field.type === 'select' ? (
              <select
                id={`basics-${field.name}`}
                name={field.name}
                value={values[field.name] ?? ''}
                disabled={isSaving}
                onChange={(event) => onChange(field.name, event.target.value)}
              >
                {field.options.map((option) => (
                  <option key={option || 'blank'} value={option}>
                    {option ? option : 'Select a state'}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`basics-${field.name}`}
                type={field.type}
                name={field.name}
                min={field.type === 'number' ? 0 : undefined}
                inputMode={field.inputMode || undefined}
                value={values[field.name] ?? ''}
                placeholder={field.placeholder || ''}
                disabled={isSaving}
                onChange={(event) => onChange(field.name, event.target.value)}
              />
            )}

            {field.hint ? <span className="ec-hint">{field.hint}</span> : null}
          </div>
        ))}
      </div>

      {formError ? (
        <p className="ec-form-error" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="ec-step-actions">
        <button type="button" className="btn" onClick={onNext} disabled={isSaving}>
          {isSaving ? 'Saving customer details...' : 'Continue to upload estimates'}
        </button>
        <span className="mini">You can change any of this later.</span>
      </div>
    </div>
  );
}
