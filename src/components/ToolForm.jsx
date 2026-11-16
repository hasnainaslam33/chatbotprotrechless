import { useEffect, useMemo, useRef, useState } from 'react';
import { AIResponse } from './AIResponse.jsx';
import { extractVideoFrames } from '../lib/videoFrames.js';

function renderField(field, index, values, onChange) {
  const key = `${field.label}-${index}`;
  const name = getFieldName(field);

  if (field.type === 'sectionHeading') {
    return <h3 className="form-section-heading" key={key}>{field.label}</h3>;
  }

  if (field.type === 'file') {
    return (
      <div className="field" key={key}>
        <label htmlFor={name}>{field.label}</label>
        <input
          id={name}
          type="file"
          name={name}
          multiple={field.multiple}
          accept={field.accept}
          required={field.required}
          onChange={(event) => onChange(name, Array.from(event.target.files || []))}
        />
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div className="field" key={key}>
        <label htmlFor={name}>{field.label}</label>
        <textarea
          id={name}
          name={name}
          value={values[name] || ''}
          required={field.required}
          onChange={(event) => onChange(name, event.target.value)}
          placeholder={field.placeholder || 'Explain symptoms, contractor recommendation, or what the camera footage showed.'}
        />
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div className="field" key={key}>
        <label htmlFor={name}>{field.label}</label>
        <select id={name} name={name} value={values[name] || ''} onChange={(event) => onChange(name, event.target.value)}>
          <option value="" disabled>
            {field.placeholder || 'Select an option'}
          </option>
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
    const optionGroups = field.optionGroups || [{ label: '', options: field.options }];
    return (
      <div className="field" key={key}>
        <label>{field.label}</label>
        <div className="check-grid">
          {optionGroups.flatMap((group) => [
            ...(group.label ? [<h3 className="check-group-heading" key={`${group.label}-heading`}>{group.label}</h3>] : []),
            ...group.options.map((option) => (
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
            ))
          ])}
        </div>
      </div>
    );
  }

  return (
    <div className="field" key={key}>
      <label htmlFor={name}>{field.label}</label>
      <input
        id={name}
        type={field.type || 'text'}
        name={name}
        value={values[name] || ''}
        required={field.required}
        autoComplete={field.autoComplete}
        onChange={(event) => onChange(name, event.target.value)}
        placeholder={field.placeholder || 'Add details'}
      />
    </div>
  );
}

function getFieldName(field) {
  return field.name || field.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
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
  const cleanItem = (item) => String(item)
    .replace(/\*\*|__|~~|`/g, '')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
    .replace(/^step\s+\d+[:.)-]\s*/i, '')
    .trim();
  const keepItem = (item) => item && !/^step\s+\d+$/i.test(item);
  if (Array.isArray(value)) {
    return value.filter(Boolean).map(cleanItem).filter(keepItem);
  }

  if (typeof value === 'string') {
    return value
      .split(/\n|•|\s+-\s+/)
      .map((item) => cleanItem(item.replace(/^[\s\-•]+/, '')))
      .filter(keepItem);
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

function buildCameraReport(structured, formContext, evidenceFrames, mode) {
  const source = structured?.cameraReport && typeof structured.cameraReport === 'object'
    ? structured.cameraReport
    : {};
  const property = source.property && typeof source.property === 'object' ? source.property : {};
  const sourceScope = source.scopeMethod && typeof source.scopeMethod === 'object' ? source.scopeMethod : {};
  const videoNames = Array.isArray(formContext['camera-video']) ? formContext['camera-video'] : [];
  const duration = formContext.videoDuration || 'Not provided';
  const frameCount = evidenceFrames.length;
  const reportUnavailable = Boolean(formContext.reviewError)
    || ['fallback', 'openai-error-fallback', 'github-error-fallback'].includes(mode);
  const method = formContext.videoReviewMethod || (frameCount
    ? `Extracted ${frameCount} evenly spaced still frames. The complete video was not reviewed frame by frame.`
    : 'No reviewable video stills were available to the AI.');
  const reviewBasis = source.reviewBasis || (
    reportUnavailable
      ? `${method} The AI review did not complete; no property findings are issued.`
      : method
  );
  const keyDetermination = source.keyDetermination || (
    reportUnavailable
      ? 'The video stills were prepared, but the AI review did not complete. No property condition conclusion or repair recommendation is issued.'
      : frameCount
        ? 'The supplied video was sampled for visual review. No structured finding was returned, so a reliable property condition conclusion cannot be made.'
        : 'No reviewable inspection imagery was available. Supply accessible footage or stills before making a property condition or repair decision.'
  );

  return {
    ...source,
    overallCondition: source.overallCondition || 'UNABLE TO DETERMINE',
    reviewBasis,
    property: {
      ...property,
      address: property.address || formContext.address || 'Not provided',
      client: property.client || formContext.name || 'Not provided',
      reportId: property.reportId || 'Not provided',
      inspectionDate: property.inspectionDate || 'Not provided',
      reportDate: new Date().toISOString().slice(0, 10),
      accessPoint: property.accessPoint || 'Not provided',
      inspector: property.inspector || 'Not provided',
      reviewer: property.reviewer || 'Not provided'
    },
    keyDetermination,
    executiveSummary: source.executiveSummary || source.summary || (
      reportUnavailable
        ? 'The AI review did not complete; no visual condition assessment was produced.'
        : structured?.summary || 'A reliable property condition conclusion cannot be made from the available evidence.'
    ),
    confidenceNote: source.confidenceNote || 'Confidence is limited by the sampled-frame review method and any visibility or coverage limitations.',
    scopeMethod: {
      ...sourceScope,
      method: sourceScope.method || method,
      limitationSummary: sourceScope.limitationSummary || (
        reportUnavailable
          ? 'The video was sampled, but the AI review did not complete.'
          : frameCount
            ? `Assessment is limited to ${frameCount} sampled still frames; unshown intervals and concealed conditions were not assessed.`
            : 'No reviewable still frames were available.'
      ),
      fileInventory: Array.isArray(sourceScope.fileInventory) && sourceScope.fileInventory.length
        ? sourceScope.fileInventory
        : videoNames.map((file) => ({
          file,
          duration,
          direction: 'Not provided',
          counterRange: 'Not verified',
          counterAtAccess: 'Not verified',
          approximateLength: 'Not verified'
        }))
    },
    findings: Array.isArray(source.findings) ? source.findings : [],
    priorityItems: Array.isArray(source.priorityItems) ? source.priorityItems : [],
    strategy: source.strategy && typeof source.strategy === 'object' ? source.strategy : {},
    evidence: Array.isArray(source.evidence) ? source.evidence : [],
    evidenceFrames,
    nextActions: Array.isArray(source.nextActions) ? source.nextActions : [],
    acceptanceCriteria: Array.isArray(source.acceptanceCriteria) ? source.acceptanceCriteria : [],
    acceptanceNote: source.acceptanceNote || 'Not applicable unless cleaning or repair work is performed.',
    finalDetermination: source.finalDetermination || source.keyDetermination || keyDetermination
  };
}

function buildResponseResult(data, moduleName, formContext = {}, evidenceFrames = []) {
  const structured = parseStructuredResponse(data);
  const risk = String(structured?.urgencyLevel || structured?.urgency || 'Medium');
  const title = structured?.aiReviewSummary || 'AI review complete';
  const summary = structured?.summary || structured?.aiReviewSummary || data?.answer || 'The AI review is ready.';
  const nextSteps = normalizeList(structured?.recommendedNextSteps);
  const questions = normalizeList(structured?.questionsToAskOrInformationToGather);
  const likelyCauses = normalizeList(structured?.likelyCauseCategories);
  const softCTA = structured?.softCTA || '';
  const disclaimer = structured?.disclaimer || '';
  const links = normalizeLinks(structured?.links);
  const fallbackLinks = normalizeLinks(data?.links);
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
    links: links.length ? links : fallbackLinks,
    cls,
    cameraReport: moduleName === 'sewer-camera-review'
      ? buildCameraReport(
        structured,
        data.providerError ? { ...formContext, reviewError: true } : formContext,
        evidenceFrames,
        data.mode
      )
      : null
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
    const critical = [
      'Sewage actively entering occupied home or business',
      'Active overflow from outside cleanout',
      'Rapid or uncontrolled sewage overflow',
      'Water or sewage near electrical systems',
      'No functioning sanitation',
      'Immediate health or property-damage risk'
    ];
    const highUrgency = [
      'Multiple fixtures backing up',
      'Multiple occupied units affected',
      'Tenant habitability issue',
      'Restaurant kitchen shutdown risk',
      'Previous sewage backups',
      'Repeated drain cleaning history'
    ];
    const highUrgencyCount = signalsList.filter((signal) => highUrgency.includes(signal)).length;
    signalsList.forEach((signal) => {
      emergencyScore += critical.includes(signal) ? 3 : highUrgency.includes(signal) ? 2 : 1;
    });
    if (signalsList.includes('Real estate closing deadline')) emergencyScore += 1;
    if (signalsList.some((signal) => critical.includes(signal)) || (highUrgencyCount >= 2 && emergencyScore >= 4)) {
      return buildResult('Emergency', 'Emergency sewer or drain risk', 'Active sewage, uncontrolled overflow, sanitation loss, electrical proximity, or immediate health or property risks should be treated as urgent.', ['Stop using water where possible.', 'Keep people away from contaminated water and electrical hazards.', 'Call or request emergency service now.'], [{ text: 'Call Pro Trenchless Services now at (484) 206-5551.', href: 'tel:4842065551' }]);
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

export function ToolForm({ fields = [], button = {}, expectedOutput = [], className = '' }) {
  const [values, setValues] = useState({});
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [evidenceFrames, setEvidenceFrames] = useState([]);
  const frameUrlsRef = useRef([]);

  useEffect(() => () => {
    frameUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const handleChange = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    let moduleName = '';
    let contextValues = {};
    let submittedFrames = [];

    try {
      moduleName = getModuleName(button.actionName, window.location.pathname);
      const userType = typeof window !== 'undefined' ? (window.localStorage.getItem('pt_user_type') || 'Homeowner') : 'Homeowner';
      const fileFields = fields.filter((field) => field.type === 'file');
      const fileFieldNames = new Set(fileFields.map(getFieldName));
      const files = fileFields.flatMap((field) => values[getFieldName(field)] || []);
      contextValues = Object.fromEntries(Object.entries(values).filter(([name]) => !fileFieldNames.has(name)));

      let uploadFiles = files;
      if (moduleName === 'sewer-camera-review') {
        const videos = files.filter((file) => file.type.startsWith('video/'));
        const extracted = [];
        for (const video of videos) {
          const result = await extractVideoFrames(video);
          extracted.push(...result.frames);
          contextValues.videoDuration = `${result.durationSeconds.toFixed(1)} seconds`;
        }
        submittedFrames = extracted;
        frameUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        frameUrlsRef.current = extracted.map((frame) => frame.previewUrl);
        setEvidenceFrames(extracted);
        uploadFiles = [...files, ...extracted.map((frame) => frame.file)];
        contextValues.videoReviewMethod = videos.length
          ? `The browser extracted ${extracted.length} evenly spaced still frames from ${videos.map((video) => video.name).join(', ')} at elapsed times ${extracted.map((frame) => frame.timestamp).join(', ')} for AI review. This is sampled-frame review, not a complete or frame-by-frame review.`
          : 'No video file was available for visual review.';
      }

      const contextForAI = { ...contextValues };
      delete contextForAI.email;
      delete contextForAI.phone;
      const contextLines = Object.entries(contextForAI)
        .filter(([, value]) => value && (Array.isArray(value) ? value.length : true))
        .map(([name, value]) => {
          const label = `${name}: ${Array.isArray(value) ? value.join(', ') : value}`;
          return label;
        });
      let uploadedFileIds = [];

      if (files.length) {
        const uploadBody = new FormData();
        uploadBody.append('module', moduleName);
        uploadBody.append('userType', userType);
        uploadBody.append('sourcePage', window.location.pathname);
        uploadFiles.forEach((file) => uploadBody.append('files', file));

        const uploadResponse = await fetch('/api/uploads', { method: 'POST', body: uploadBody });
        const uploadData = await uploadResponse.json();
        if (!uploadResponse.ok) {
          throw new Error(uploadData.error || `File upload failed with status ${uploadResponse.status}`);
        }

        contextValues[getFieldName(fileFields[0])] = files.map((file) => file.name);
        contextLines.push(`Uploaded original files: ${files.map((file) => file.name).join(', ')}`);
        uploadedFileIds = uploadData.files.map((file) => file.id);
      }

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
          formContext: contextForAI,
          uploadedFileIds
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

      if (data.providerError) setError(data.providerError);
      setResult(buildResponseResult(data, moduleName, contextValues, submittedFrames));
    } catch (requestError) {
      setError(requestError.message || 'Could not reach the AI service.');
      if (moduleName === 'sewer-camera-review') {
        contextValues.reviewError = true;
        const fileField = fields.find((field) => field.type === 'file');
        const reportContext = {
          ...contextValues,
          [fileField ? getFieldName(fileField) : 'camera-video']: (values[fileField ? getFieldName(fileField) : 'camera-video'] || []).map((file) => file.name)
        };
        setResult(buildResponseResult({}, moduleName, reportContext, submittedFrames));
      } else {
        setResult(buildFallbackResult(button.actionName, values));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resultMarkup = useMemo(() => {
    if (!result) return null;
    return <AIResponse result={result} />;
  }, [result]);

  return (
    <form className={`panel ${className}`.trim()} onSubmit={handleSubmit}>
      <h2>{button.panelHeading || 'Guided intake'}</h2>
      {button.panelSubheading ? <p className="mini">{button.panelSubheading}</p> : null}
      <div className="form-section">
        {fields.map((field, index) => renderField(field, index, values, handleChange))}
        <button className={`btn ${button.variant || ''}`} type="submit" disabled={isLoading}>
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
    </form>
  );
}
