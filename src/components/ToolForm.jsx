import { useMemo, useState } from 'react';
import { AIResponse } from './AIResponse.jsx';

function renderField(field, index, values, onChange) {
  const key = `${field.label}-${index}`;
  const name = field.name || field.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  if (field.type === 'textarea') {
    return (
      <div className="field" key={key}>
        <label>{field.label}</label>
        <textarea
          name={name}
          value={values[name] || ''}
          onChange={(event) => onChange(name, event.target.value)}
          placeholder={field.placeholder || 'Explain symptoms, contractor recommendation, or what the camera footage showed.'}
        />
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div className="field" key={key}>
        <label>{field.label}</label>
        <select name={name} value={values[name] || ''} onChange={(event) => onChange(name, event.target.value)}>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === 'checkboxGroup') {
    return (
      <div className="field" key={key}>
        <label>{field.label}</label>
        <div className="check-grid">
          {field.options.map((option) => (
            <label className="check" key={option}>
              <input
                type="checkbox"
                name={name}
                value={option}
                checked={Boolean(values[name]?.includes(option))}
                onChange={(event) => {
                  const current = values[name] || [];
                  const updated = event.target.checked
                    ? [...current, option]
                    : current.filter((item) => item !== option);
                  onChange(name, updated);
                }}
              />{' '}
              {option}
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="field" key={key}>
      <label>{field.label}</label>
      <input
        type={field.type || 'text'}
        name={name}
        value={values[name] || ''}
        onChange={(event) => onChange(name, event.target.value)}
        placeholder={field.placeholder || 'Add details'}
      />
    </div>
  );
}

function buildResult(risk, title, summary, nextSteps, links) {
  const cls = String(risk || 'medium').toLowerCase().replace(/moderate/g, 'medium').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'medium';

  return {
    risk,
    title,
    summary,
    nextSteps,
    links,
    cls
  };
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/\n|•|-/)
      .map((item) => item.replace(/^[\s\-•]+/, '').trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeLinks(value = []) {
  if (Array.isArray(value)) {
    return value
      .filter(Boolean)
      .map((link) => {
        if (typeof link === 'string') {
          return { text: link, href: link };
        }

        const href = typeof link?.href === 'string' ? link.href : '';
        const text = typeof link?.text === 'string' ? link.text : href || 'Learn more';
        return href ? { text, href } : null;
      })
      .filter(Boolean);
  }

  return [];
}

function parseStructuredResponse(payload) {
  const structured = payload?.structuredAnswer;
  if (structured && typeof structured === 'object') {
    return structured;
  }

  if (typeof payload?.answer === 'string') {
    const trimmed = payload.answer.trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        const parsed = JSON.parse(trimmed.slice(start, end + 1));
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      } catch (error) {
        // fall back to plain text rendering below
      }
    }
  }

  return null;
}

function buildResponseResult(data) {
  const structured = parseStructuredResponse(data);
  const risk = String(structured?.urgencyLevel || structured?.urgency || 'Medium');
  const title = structured?.aiReviewSummary || structured?.summary || 'AI review complete';
  const summary = structured?.summary || structured?.aiReviewSummary || data?.answer || 'The AI review is ready.';
  const nextSteps = normalizeList(structured?.recommendedNextSteps);
  const questions = normalizeList(structured?.questionsToAskOrInformationToGather);
  const likelyCauses = normalizeList(structured?.likelyCauseCategories);
  const softCTA = structured?.softCTA || '';
  const disclaimer = structured?.disclaimer || '';
  const links = normalizeLinks(structured?.links || data?.links || []);
  const cls = String(risk || 'medium').toLowerCase().replace(/moderate/g, 'medium').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'medium';

  return {
    risk,
    title,
    summary,
    nextSteps,
    questions,
    likelyCauses,
    softCTA,
    disclaimer,
    links,
    cls
  };
}

function getModuleName(actionName, pathname) {
  const slug = pathname.split('/').filter(Boolean).pop();
  const actionMap = {
    runSymptomChecker: 'symptom-checker',
    runEmergencyCheck: 'emergency-risk-check',
    runEstimateReview: 'estimate-review',
    runCostEstimator: 'cost-estimator'
  };

  return actionMap[actionName] || slug || 'free-second-opinion';
}

function buildFallbackResult(actionName, values) {
  const fixtures = values.fixture || [];
  const signals = values.signal || [];
  const repeat = values.repeat || '';
  let score = 0;

  if (fixtures.includes('Multiple fixtures')) score += 3;
  if (fixtures.includes('Outside cleanout')) score += 2;
  if (signals.includes('Sewage smell')) score += 2;
  if (signals.includes('Water comes up from another fixture')) score += 3;
  if (signals.includes('Recent heavy rain')) score += 1;
  if (signals.includes('Large trees nearby')) score += 1;
  if (signals.includes('Prior repeated cleanings')) score += 2;
  if (repeat === 'Every time water is used') score += 3;
  if (repeat === 'Keeps coming back') score += 2;

  let risk = 'Low';
  let title = 'Lower risk drain issue';
  let summary = 'The symptoms may point to a localized clog or early-stage restriction, but the cause still needs to be verified before money is spent on repair work.';
  const steps = [
    'Avoid approving major repair work without camera verification.',
    'Document when the backup happens and which fixtures are affected.',
    'Consider cleaning or camera inspection if the issue returns.'
  ];

  if (score >= 8) {
    risk = 'Emergency';
    title = 'Possible main sewer backup or serious restriction';
    summary = 'Multiple fixtures, repeated backups, cross-flow, sewage odor, or outside cleanout activity can point to a main sewer issue that should be checked urgently.';
    steps.splice(0, steps.length, 'Stop using water where possible if sewage is active.', 'Request sewer camera inspection with locate once the line can be safely accessed.', 'Ask for Good / Better / Best repair options before approving replacement.');
  } else if (score >= 5) {
    risk = 'High';
    title = 'High risk recurring sewer restriction';
    summary = 'Your answers suggest this may be more than a one-time clog. Root intrusion, an offset joint, belly, heavy scale, or partial collapse may need to be ruled out.';
    steps.splice(0, steps.length, 'Schedule a sewer camera inspection with locate.', 'Ask whether hydro jetting, cleaning, pipe bursting, lining, spot repair, or replacement fits the actual defect.', 'Get a second opinion before approving a full replacement.');
  } else if (score >= 3) {
    risk = 'Medium';
    title = 'Moderate sewer or drain risk';
    summary = 'There are enough warning signs to avoid guessing. Cleaning may help, but a camera inspection may be smarter if the issue is recurring.';
    steps.splice(0, steps.length, 'Track symptoms and recent rain or water usage patterns.', 'Ask whether a camera inspection is appropriate before repeated drain cleaning.', 'Review trenchless options if a structural defect is found.');
  }

  if (actionName === 'runEmergencyCheck') {
    const signalsList = values.emergency || [];
    let emergencyScore = 0;
    const critical = ['Sewage actively entering home or business', 'Multiple fixtures backing up', 'Water near electrical systems', 'Restaurant kitchen shutdown risk'];
    signalsList.forEach((signal) => {
      emergencyScore += critical.includes(signal) ? 3 : 1;
    });
    if (signalsList.includes('Real estate closing deadline')) emergencyScore += 1;
    if (emergencyScore >= 6) {
      return buildResult('Emergency', 'Emergency sewer or drain risk', 'Active sewage, multiple backed-up fixtures, electrical proximity, or business shutdown risk should be treated as urgent.', ['Stop using water where possible.', 'Keep people away from contaminated water.', 'Call or request emergency service now.'], [{ text: 'Call Pro Trenchless Services now at (484) 206-5551.', href: 'tel:4842065551' }]);
    }
    if (emergencyScore >= 3) {
      return buildResult('Urgent', 'Urgent sewer attention recommended', 'The issue may not be a full emergency yet, but it should not wait if symptoms are recurring or spreading.', ['Limit water use until the line is checked.', 'Request camera inspection with locate.', 'Ask for written findings and repair options.'], [{ text: 'Review sewer backup service options.', href: 'https://protrenchless.com/sewer-backup/' }]);
    }
    return buildResult('Scheduled', 'Likely scheduled service', 'No emergency signals were selected. A planned inspection or second opinion may still help avoid guesswork.', ['Take photos or video of the issue.', 'Do not approve a major repair without clear camera findings.', 'Schedule service during normal hours if the issue is stable.'], [{ text: 'Book an inspection or send details.', href: '#lead-form' }]);
  }

  if (actionName === 'runEstimateReview') {
    const items = values.estimate || [];
    const missing = ['Pipe footage', 'Pipe material', 'Depth', 'Surface restoration', 'Permits', 'Utility marking', 'Camera verification', 'Warranty', 'Cleanout details', 'Good / Better / Best options'].filter((item) => !items.includes(item));
    const fallbackRisk = missing.length >= 6 ? 'High' : missing.length >= 3 ? 'Medium' : 'Low';
    const fallbackTitle = missing.length ? 'Estimate may need clarification' : 'Estimate looks more complete than average';
    const fallbackSummary = missing.length ? `Before approving the work, clarify these missing items: ${missing.join(', ')}.` : 'The estimate includes several important scope details. Still, final pricing and method should match verified camera findings.';
    return buildResult(fallbackRisk, fallbackTitle, fallbackSummary, ['Ask the contractor to explain the defect, footage, material, depth, access, restoration, and warranty in writing.', 'Ask whether cleaning, hydro jetting, lining, pipe bursting, spot repair, or replacement was considered.', 'Get a second opinion before approving a large replacement if the estimate feels vague.'], [{ text: 'Review sewer repair options before approving an estimate.', href: 'https://protrenchless.com/sewer-repair/' }]);
  }

  if (actionName === 'runCostEstimator') {
    const length = Number(values.length || 0);
    const depth = Number(values.depth || 0);
    const surface = String(values.surface || 'grass').toLowerCase();
    let baseLow = 900;
    let baseHigh = 3500;
    if (length > 40) {
      baseLow += 2500;
      baseHigh += 7000;
    }
    if (length > 80) {
      baseLow += 3000;
      baseHigh += 9000;
    }
    if (depth > 6) {
      baseLow += 2500;
      baseHigh += 8000;
    }
    if (['driveway', 'sidewalk', 'street', 'basement floor'].includes(surface)) {
      baseLow += 1800;
      baseHigh += 6500;
    }
    const label = `$${baseLow.toLocaleString()} to $${baseHigh.toLocaleString()}+`;
    return buildResult('Medium', 'Rough planning range only', `Based on the basic details provided, a planning range could be around ${label}. This is not a quote. Sewer repair pricing can change heavily after camera inspection, locate, depth confirmation, permits, and restoration review.`, ['Book a camera inspection and locate before final repair planning.', 'Ask what raises the price: depth, hard surfaces, access limits, permits, restoration, or emergency timing.', 'Compare least-destructive options before excavation is approved.'], [{ text: 'Learn more about trenchless sewer repair options.', href: 'https://protrenchless.com/trenchless-sewer-repair/' }]);
  }

  if (actionName === 'runSymptomChecker') {
    return buildResult(risk, title, summary, steps, [{ text: 'Learn more about sewer camera inspections in Southeastern Pennsylvania.', href: 'https://protrenchless.com/sewer-camera-inspection/' }]);
  }

  return buildResult('Medium', 'Guided intake received', 'The form details have been captured. A follow-up message can be sent from the lead form below.', ['Add more context if the issue is recurring or urgent.', 'Review the lead form to send the details to Pro Trenchless.'], []);
}

export function ToolForm({ fields = [], button = {}, expectedOutput = [] }) {
  const [values, setValues] = useState({});
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
  };

  const handleButtonClick = async () => {
    setIsLoading(true);
    setError('');

    try {
      const moduleName = getModuleName(button.actionName, window.location.pathname);
      const userType = typeof window !== 'undefined' ? (window.localStorage.getItem('pt_user_type') || 'Homeowner') : 'Homeowner';
      const contextLines = Object.entries(values)
        .filter(([, value]) => value && (Array.isArray(value) ? value.length : true))
        .map(([name, value]) => {
          const label = `${name}: ${Array.isArray(value) ? value.join(', ') : value}`;
          return label;
        });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: moduleName,
          userType,
          messages: [
            {
              role: 'user',
              content: `Use the intake details below to provide a clear sewer or drain decision-center response.\n\nIntake details:\n${contextLines.join('\n') || 'No intake details provided.'}`
            }
          ],
          formContext: values,
          uploadedFileIds: []
        })
      });

      // Safely handle responses that may be empty or not valid JSON
      const text = await response.text();
      let data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error(`Invalid JSON response from server: ${text.slice(0, 200)}`);
        }
      }

      if (!response.ok) {
        // prefer structured error from server when available
        throw new Error((data && data.error) || `AI request failed with status ${response.status}`);
      }

      setResult(buildResponseResult(data));
    } catch (requestError) {
      setError(requestError.message || 'Could not reach the AI service.');
      setResult(buildFallbackResult(button.actionName, values));
    } finally {
      setIsLoading(false);
    }
  };

  const resultMarkup = useMemo(() => {
    if (!result) return null;
    return <AIResponse result={result} />;
  }, [result]);

  return (
    <div className="panel">
      <h2>{button.panelHeading || 'Guided intake'}</h2>
      {button.panelSubheading ? <p className="mini">{button.panelSubheading}</p> : null}
      <div className="form-section">
        {fields.map((field, index) => renderField(field, index, values, handleChange))}
        <button className={`btn ${button.variant || ''}`} type="button" onClick={handleButtonClick} disabled={isLoading}>
          {isLoading ? 'Reviewing...' : button.label}
        </button>
      </div>

      {error ? <p className="mini" style={{ color: '#b3261e' }}>{error}</p> : null}

      {expectedOutput.length > 0 ? (
        <>
          <h3>Expected AI output</h3>
          <ul>
            {expectedOutput.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}

      {resultMarkup}
    </div>
  );
}
