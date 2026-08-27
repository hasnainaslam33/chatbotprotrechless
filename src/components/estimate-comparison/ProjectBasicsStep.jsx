import { projectBasicsFields } from '../../lib/comparisonConfig.js';

/**
 * Step 1. Everything here is optional on purpose — homeowners are not expected
 * to know pipe material or depth, and "Unknown" must never block progress.
 * The real technical detail is extracted from the uploaded estimates instead.
 */
export default function ProjectBasicsStep({ values, onChange, onNext }) {
  return (
    <div className="ec-step-panel">
      <header className="ec-panel-head">
        <h2 className="ec-panel-title">Tell us about the project</h2>
        <p className="mini">
          Every question here is optional. Pick <strong>Unknown</strong> whenever you are not sure — it will not hold anything up. Most
          technical detail is read automatically from the estimates you upload next.
        </p>
      </header>

      <div className="ec-basics-grid">
        {projectBasicsFields.map((field) => (
          <div className="field ec-field" key={field.name}>
            <label htmlFor={`basics-${field.name}`}>
              {field.label} <span className="ec-optional">optional</span>
            </label>

            {field.type === 'select' ? (
              <select
                id={`basics-${field.name}`}
                name={field.name}
                value={values[field.name] ?? ''}
                onChange={(event) => onChange(field.name, event.target.value)}
              >
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`basics-${field.name}`}
                type={field.type}
                name={field.name}
                min={field.type === 'number' ? 0 : undefined}
                value={values[field.name] ?? ''}
                placeholder={field.placeholder || ''}
                onChange={(event) => onChange(field.name, event.target.value)}
              />
            )}

            {field.hint ? <span className="ec-hint">{field.hint}</span> : null}
          </div>
        ))}
      </div>

      <div className="ec-step-actions">
        <button type="button" className="btn" onClick={onNext}>
          Continue to upload estimates
        </button>
        <span className="mini">You can change any of this later.</span>
      </div>
    </div>
  );
}
