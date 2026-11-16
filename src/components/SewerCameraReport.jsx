import { useMemo } from 'react';

function text(value, fallback = 'Not provided') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function formatCondition(value) {
  const allowed = [
    'SATISFACTORY WITHIN THE DOCUMENTED SCOPE',
    'MAINTENANCE OR FURTHER EVALUATION REQUIRED',
    'UNSATISFACTORY',
    'UNABLE TO DETERMINE'
  ];
  const match = allowed.find((condition) => condition.toLowerCase() === String(value || '').toLowerCase());
  return match || 'UNABLE TO DETERMINE';
}

function ReportTable({ headers, children, className = '' }) {
  return (
    <div className={`camera-report-table-wrap ${className}`.trim()}>
      <table className="camera-report-table">
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Section({ number, title, children }) {
  return (
    <section className="camera-report-section">
      <h2><span>{number}.</span> {title}</h2>
      {children}
    </section>
  );
}

function EmptyRow({ span, children }) {
  return <tr><td className="camera-report-empty" colSpan={span}>{children}</td></tr>;
}

function EvidenceFigure({ frame, evidence, index }) {
  const label = text(evidence?.label, `Evidence ${String.fromCharCode(65 + index)}`);
  const findingIds = list(evidence?.findingIds);
  const caption = text(
    evidence?.caption,
    `Sampled still from ${frame.sourceFileName} at elapsed ${frame.timestamp}. No finding link was supplied.`
  );

  return (
    <figure className="camera-report-figure">
      <h3>{label}{findingIds.length ? ` · ${findingIds.join(', ')}` : ''}</h3>
      <img src={frame.previewUrl} alt={`${label}: sampled video still at ${frame.timestamp}`} />
      <figcaption>
        <strong>{text(evidence?.source, frame.sourceFileName)}</strong>
        {' · Elapsed time: '}{text(evidence?.timestamp, frame.timestamp)}
        {' · Raw counter: '}{text(evidence?.counter, 'Not visible / not verified')}
        <br />
        {caption}
      </figcaption>
    </figure>
  );
}

export default function SewerCameraReport({ report, evidenceFrames = [] }) {
  const condition = formatCondition(report?.overallCondition);
  const property = report?.property || {};
  const scope = report?.scopeMethod || {};
  const strategy = report?.strategy || {};
  const findings = list(report?.findings);
  const priorities = list(report?.priorityItems).length
    ? list(report?.priorityItems)
    : findings.map((finding, index) => ({
      priority: String(index + 1),
      findingId: finding.id,
      finding: finding.observation,
      severity: finding.severity,
      operationalEffect: finding.significance
    }));
  const options = list(strategy.options);
  const evidence = list(report?.evidence);
  const actions = list(report?.nextActions);
  const criteria = list(report?.acceptanceCriteria);

  const evidenceByFrame = useMemo(() => {
    const map = new Map();
    evidence.forEach((item) => {
      const frameIndex = Number(item?.frameIndex);
      if (Number.isInteger(frameIndex) && frameIndex > 0) map.set(frameIndex - 1, item);
    });
    return map;
  }, [evidence]);

  const conditionClass = condition.toLowerCase().replace(/[^a-z]+/g, '-').replace(/(^-|-$)/g, '');

  return (
    <article className="camera-report">
      <div className="camera-report-actions">
        <button type="button" className="btn secondary" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      <header className="camera-report-header">
        <div className="camera-report-running-header">PRO TRENCHLESS SERVICES | SEWER CCTV CONDITION REPORT</div>
        <div className="camera-report-brand">PRO TRENCHLESS SERVICES</div>
        <h1>Sewer CCTV Forensic<br />Condition Report</h1>
        <p>{text(report?.reviewBasis, 'AI-assisted review of the supplied inspection evidence; sampled frames only, where available.')}</p>
      </header>

      <div className={`camera-report-condition ${conditionClass}`}>
        <strong>OVERALL CONDITION: {condition}</strong>
        <span>Report condition label only; not a municipal pass/fail decision.</span>
      </div>

      <ReportTable headers={['Property / inspection detail', 'Recorded information']} className="camera-report-meta">
        {[
          ['Property address', property.address],
          ['Client / owner', property.client],
          ['Report / job ID', property.reportId],
          ['Inspection date', property.inspectionDate],
          ['Report date', property.reportDate],
          ['Access point', property.accessPoint],
          ['Inspector / reviewer', [property.inspector, property.reviewer].filter((value) => value && value !== 'Not provided').join(' / ') || 'Not provided'],
          ['Inspection basis', report?.reviewBasis]
        ].map(([label, value]) => (
          <tr key={label}><th scope="row">{label}</th><td>{text(value)}</td></tr>
        ))}
      </ReportTable>

      <div className="camera-report-determination">
        <strong>KEY DETERMINATION</strong>
        <p>{text(report?.keyDetermination, 'The available information is insufficient to determine the inspected pipe condition. Supply reviewable inspection evidence before selecting a repair.')}</p>
      </div>

      <p className="camera-report-notice">
        This report assesses only the documented inspection evidence. It is not municipal certification, an engineering approval, or an insurance coverage decision.
      </p>

      <Section number="1" title="Executive Summary">
        <p>{text(report?.executiveSummary, 'A reliable property condition conclusion cannot be made from the information currently available.')}</p>
        <ReportTable headers={['Priority', 'Finding and finding ID', 'Severity', 'Operational effect']}>
          {priorities.length ? priorities.map((item, index) => (
            <tr key={`${item.findingId || 'priority'}-${index}`}>
              <td>{text(item.priority, String(index + 1))}</td>
              <td>{text(item.findingId)}{item.finding ? ` · ${item.finding}` : ''}</td>
              <td>{text(item.severity, 'Not assessed')}</td>
              <td>{text(item.operationalEffect)}</td>
            </tr>
          )) : <EmptyRow span={4}>No property finding has been established from the available evidence.</EmptyRow>}
        </ReportTable>
        <p className="camera-report-small">
          <strong>Overall condition:</strong> {condition}. {text(report?.confidenceNote, 'Confidence is limited to the evidence and coverage described in this report.')}
        </p>
      </Section>

      <Section number="2" title="Scope, Method, and Limitations">
        <p>{text(scope.purpose, 'Inspection purpose was not provided.')}</p>
        <div className="camera-report-facts">
          {[
            ['Method', scope.method],
            ['Access / direction', scope.accessDirection],
            ['Pipe material / diameter', scope.pipeDescription],
            ['Coverage', scope.coverage],
            ['Cleaning / flow conditions', scope.cleaningFlow]
          ].map(([label, value]) => <p key={label}><strong>{label}:</strong> {text(value)}</p>)}
        </div>
        <ReportTable headers={['File', 'Duration', 'Direction', 'Counter range', 'Counter at access', 'Approx. inspected length']}>
          {list(scope.fileInventory).length ? list(scope.fileInventory).map((file, index) => (
            <tr key={`${file.file || 'file'}-${index}`}>
              <td>{text(file.file)}</td><td>{text(file.duration)}</td><td>{text(file.direction)}</td>
              <td>{text(file.counterRange)}</td><td>{text(file.counterAtAccess)}</td><td>{text(file.approximateLength)}</td>
            </tr>
          )) : <EmptyRow span={6}>No inspection file inventory was provided.</EmptyRow>}
        </ReportTable>
        {list(scope.limitations).length ? (
          <ul className="camera-report-list">{list(scope.limitations).map((item, index) => <li key={index}>{item}</li>)}</ul>
        ) : <p className="camera-report-small">Coverage and visibility limitations: {text(scope.limitationSummary)}</p>}
      </Section>

      <Section number="3" title="Detailed Findings">
        <p className="camera-report-small">Severity and confidence are separate qualitative judgments. They are not a standardized certification grade.</p>
        <ReportTable headers={['ID', 'Source / raw counter', 'Observed condition', 'Severity / confidence']}>
          {findings.length ? findings.map((finding, index) => (
            <tr key={finding.id || index}>
              <td><strong>{text(finding.id, `F-${String(index + 1).padStart(2, '0')}`)}</strong></td>
              <td>{text(finding.source)}<br />Raw counter: {text(finding.rawCounter, 'Not verified')}</td>
              <td>
                <strong>Observed:</strong> {text(finding.observation)}<br />
                <strong>Significance:</strong> {text(finding.significance)}<br />
                <strong>Confirmation:</strong> {text(finding.confirmation)}
              </td>
              <td><strong>{text(finding.severity, 'NOT ASSESSABLE')}</strong><br />{text(finding.confidence, 'Confidence not stated')}</td>
            </tr>
          )) : <EmptyRow span={4}>No property condition finding can be established from the supplied review evidence.</EmptyRow>}
        </ReportTable>
      </Section>

      <Section number="4" title="Corrective Strategy and Decision Rules">
        <p>{text(strategy.summary, 'No corrective work is selected unless a documented finding supports it. Obtain adequate evidence before choosing a repair.')}</p>
        <ReportTable headers={['Option', 'Best use / expected value', 'Advantages', 'Limitations / risk']}>
          {options.length ? options.map((option, index) => (
            <tr key={`${option.option || 'option'}-${index}`}>
              <td>{text(option.option)}</td><td>{text(option.bestUse)}</td><td>{text(option.advantages)}</td><td>{text(option.limitations)}</td>
            </tr>
          )) : <EmptyRow span={4}>No repair option is selected without a supported property finding.</EmptyRow>}
        </ReportTable>
        <p className="camera-report-caution">Cleaning may restore visibility but does not repair structural defects or establish pipe grade. Confirm location and field conditions before invasive work.</p>
      </Section>

      <Section number="5" title="Representative Video Evidence">
        <p className="camera-report-small">Images below are sampled stills, not a frame-by-frame review. Elapsed timestamps and counter readings are shown only when available.</p>
        {evidenceFrames.length ? (
          <div className="camera-report-evidence">
            {evidenceFrames.map((frame, index) => (
              <EvidenceFigure key={`${frame.sourceFileName}-${frame.timestamp}`} frame={frame} evidence={evidenceByFrame.get(index)} index={index} />
            ))}
          </div>
        ) : evidence.length ? (
          <div className="camera-report-evidence">
            {evidence.map((item, index) => (
              <figure className="camera-report-placeholder" key={`${item.label || 'evidence'}-${index}`}>
                <div>IMAGE PLACEHOLDER · {text(list(item.findingIds).join(', '), 'Finding not linked')}</div>
                <figcaption>{text(item.source)} · {text(item.timestamp, 'Timestamp not available')} · {text(item.counter, 'Raw counter not visible')}<br />{text(item.caption)}</figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="camera-report-placeholder">No reviewable video stills were available for this report.</div>
        )}
      </Section>

      <Section number="6" title="Required Next Actions">
        {actions.length ? (
          <ol className="camera-report-actions-list">
            {actions.map((action, index) => (
              <li key={index}>
                <strong>{text(action.action)}</strong>
                <span>{text(action.purpose)} Priority: {text(action.priority, 'Not assigned')}. Responsible party: {text(action.responsible, 'Not provided')}.</span>
              </li>
            ))}
          </ol>
        ) : (
          <p>Obtain reviewable inspection evidence and a qualified review before making a property condition or repair decision.</p>
        )}
      </Section>

      <Section number="7" title="Post-Repair / Post-Clean Acceptance Criteria">
        <p>{text(report?.acceptanceNote, 'Not applicable unless cleaning or repair work is performed.')}</p>
        {criteria.length ? (
          <ul className="camera-report-checklist">
            {criteria.map((criterion, index) => <li key={index}><span aria-hidden="true">☐</span> {criterion}</li>)}
          </ul>
        ) : <p>Retain before-and-after documentation for any completed work. CCTV alone does not establish watertightness, code compliance, or municipal acceptance.</p>}
      </Section>

      <div className="camera-report-final">
        <strong>FINAL DETERMINATION</strong>
        <p>{text(report?.finalDetermination, `Overall condition: ${condition}. ${text(report?.keyDetermination, 'No reliable property condition conclusion is available.')}`)}</p>
      </div>

      <div className="camera-report-signoff">
        <p>Prepared for: <strong>Pro Trenchless Services</strong></p>
        <p>Preparer / reviewer: {text(report?.reviewer, 'Not provided')}</p>
        <p>Verified credentials: {text(report?.credentials, 'Not provided')}</p>
        <p>Signature: ____________________________________  Date: __________________</p>
      </div>
      <footer className="camera-report-footer">
        <p>© {new Date().getFullYear()} Pro Trenchless Services. All rights reserved.</p>
        <p>Prepared for the identified property and client. The client may share this report with advisers, contractors, insurers, and transaction participants for evaluating this property. Other uses of Pro Trenchless Services’ original report text and presentation require permission, subject to applicable law. Rights in third-party inspection media remain with their respective owners.</p>
      </footer>
    </article>
  );
}
