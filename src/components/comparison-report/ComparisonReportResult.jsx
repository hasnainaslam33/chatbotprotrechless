import styles from './ComparisonReport.module.css';
import ComparisonCards from './ComparisonCards.jsx';
import DataTable from './DataTable.jsx';
import MetaStrip from './MetaStrip.jsx';
import PageTitle from './PageTitle.jsx';
import ReportFooter from './ReportFooter.jsx';
import ReportHeader from './ReportHeader.jsx';
import ResultBanner from './ResultBanner.jsx';
import StatusKey from './StatusKey.jsx';
import TierCards from './TierCards.jsx';
import WinnersRow from './WinnersRow.jsx';
import '../../tokens.css';

function fieldValue(contractor, key, fallback = 'Not stated') {
  const field = contractor.fields?.find((item) => item.key === key);
  if (!field) return fallback;
  if (field.value) return field.value;
  if (field.status === 'clearly_included') return 'Included';
  if (field.status === 'clearly_excluded') return 'Excluded';
  if (field.status === 'needs_clarification') return 'Needs clarification';
  return fallback;
}

function fieldStatus(contractor, key) {
  return contractor.fields?.find((item) => item.key === key)?.status || 'not_stated';
}

function ownershipValue(contractor) {
  const license = contractor.fields?.find((item) => item.key === 'license_number');
  return license?.value ? 'Ownership verified' : 'Ownership not verified';
}

function statusTone(status) {
  if (status === 'clearly_included') return 'green';
  if (status === 'clearly_excluded') return 'red';
  if (status === 'needs_clarification') return 'orange';
  return 'gray';
}

function priceLabel(contractor) {
  if (!Number.isFinite(contractor.totalPrice)) return 'Not stated';
  return `$${contractor.totalPrice.toLocaleString()}`;
}

function riskLabel(contractor) {
  if ((contractor.warningCount || 0) >= 8) return 'HIGH';
  if ((contractor.warningCount || 0) >= 4) return 'MEDIUM';
  return 'LOW';
}

function warrantyRows(contractors) {
  return [
    ['Manufacturer product coverage', 'manufacturer_warranty'],
    ['Contractor material coverage', 'warranty_length'],
    ['Contractor labor coverage', 'contractor_labor_warranty'],
    ['Workmanship coverage', 'workmanship_warranty'],
    ['Structural coverage', 'structural_warranty'],
    ['Cleanout coverage', 'cleanout_coverage'],
    ['Connection coverage', 'connection_coverage'],
    ['Yard repair warranty', 'yard_warranty'],
    ['Prorated over time', 'warranty_prorated'],
    ['Can transfer to new owner', 'warranty_transferable'],
    ['Number of transfers', 'warranty_transfer_count'],
    ['Transfer fee', 'warranty_transfer_fee'],
    ['Transfer deadline', 'warranty_transfer_deadline'],
    ['Who handles the claim', 'warranty_claim_handler']
  ].map(([label, key]) => ({ label, ...Object.fromEntries(contractors.map((contractor, index) => [`company${index}`, fieldValue(contractor, key)])) }));
}

function evidenceRows(contractors, definitions) {
  return definitions.map(([label, key]) => ({ label, ...Object.fromEntries(contractors.map((contractor, index) => [`company${index}`, fieldValue(contractor, key)])) }));
}

function createReport(analysis) {
  const contractors = analysis.contractors || [];
  const top = [...contractors].sort((a, b) => b.overallScore - a.overallScore)[0];
  const lowest = [...contractors].sort((a, b) => (a.totalPrice || Infinity) - (b.totalPrice || Infinity))[0];
  const warrantyLeader = [...contractors].sort((a, b) => (b.groupScores?.find((item) => item.id === 'warranty')?.score || 0) - (a.groupScores?.find((item) => item.id === 'warranty')?.score || 0))[0];
  const items = contractors.map((contractor, index) => ({
    name: contractor.contractorName,
    score: contractor.overallScore,
    price: priceLabel(contractor),
    ownership: ownershipValue(contractor),
    bestOption: contractor.proposedMethod,
    warranty: contractor.warranties?.[0]?.length || fieldValue(contractor, 'warranty_length'),
    questionsLeft: contractor.missingCount,
    risk: contractor.warningCount >= 8 ? 'High' : contractor.warningCount >= 4 ? 'Medium' : 'Low',
    ribbon: contractor.labels?.[0] || 'Proposal reviewed',
    accent: ['green', 'purple', 'blue'][index] || 'blue'
  }));
  const companyColumns = contractors.map((contractor, index) => ({ key: `company${index}`, label: contractor.contractorName }));
  const scoreRows = ['scope', 'price', 'warranty', 'verification', 'customer'].map((groupId) => {
    const labels = { scope: 'Work details', price: 'Price clarity', warranty: 'Warranty', verification: 'Proof after work', customer: 'Customer protection' };
    const row = { part: labels[groupId] };
    contractors.forEach((contractor, index) => {
      const group = contractor.groupScores?.find((item) => item.id === groupId);
      row[`company${index}`] = group ? `${group.earned} / ${group.possible}` : 'Not stated';
    });
    return row;
  });
  const featureDefinitions = [
    ['Exact repair and footage', 'repair_method', 'total_footage_repaired'],
    ['Who will do the work', 'employees_or_subs'],
    ['Permits and inspection', 'permits_included'],
    ['Digging, backfill, compaction', 'backfill_included'],
    ['Yard or surface repair', 'yard_restoration'],
    ['Before and after camera proof', 'camera_video_provided'],
    ['Written job records', 'completion_report'],
    ['Parts and labor warranty', 'contractor_labor_warranty'],
    ['Written approval for extra work', 'written_change_order'],
    ['Service guarantees explained', 'satisfaction_guarantee']
  ];
  const featureRows = featureDefinitions.map(([matter, ...keys]) => {
    const row = { matter };
    contractors.forEach((contractor, index) => {
      row[`company${index}`] = keys.map((key) => fieldValue(contractor, key)).filter((value) => value !== 'Not stated').join(' - ') || 'Not stated';
    });
    return row;
  });
  const warrantyColumns = companyColumns;
  const warrantyEvidence = warrantyRows(contractors);
  const guaranteeEvidence = evidenceRows(contractors, [
    ['Satisfaction guarantee', 'satisfaction_guarantee'],
    ['Protect your property', 'property_damage_responsibility'],
    ['Clean up after the job', 'cleanup'],
    ['Camera proof', 'camera_video_provided'],
    ['Price change protection', 'change_order_process'],
    ['Return to correct a problem', 'workmanship_warranty']
  ]);
  const costEvidence = evidenceRows(contractors, [
    ['Permits and fees', 'permits_included'],
    ['Yard or surface repair', 'yard_restoration'],
    ['Extra footage price', 'additional_footage_price'],
    ['Rock or blocked access', 'rock_charges'],
    ['Code-required changes', 'change_order_process']
  ]);
  const questionPacks = analysis.contractorQuestions || [];

  return {
    contractors,
    companyColumns,
    top,
    lowest,
    warrantyLeader,
    items,
    scoreRows,
    featureRows,
    warrantyColumns,
    warrantyEvidence,
    guaranteeEvidence,
    costEvidence,
    questionPacks,
    customer: analysis.customer || {},
    reportId: analysis.reportId || 'Pending',
    reportDate: analysis.reportDate ? new Date(analysis.reportDate).toLocaleDateString() : 'Today'
  };
}

export default function ComparisonReportResult({ analysis, onStartOver }) {
  const report = createReport(analysis);
  const columns = [{ key: 'part', label: 'Score part' }, ...report.companyColumns];
  const featureColumns = [{ key: 'matter', label: 'What matters' }, ...report.companyColumns];
  const totals = { part: 'TOTAL' };
  report.contractors.forEach((contractor, index) => { totals[`company${index}`] = `${contractor.overallScore} / 100`; });
  const address = [report.customer.streetAddress, report.customer.city, report.customer.state, report.customer.zipCode].filter(Boolean).join(', ');
  const winnerItems = [
    { label: 'Best overall value', name: report.top?.contractorName || 'Not stated', detail: report.top?.documentNotes || 'Highest documented balance.' },
    { label: 'Lowest stated price', name: report.lowest?.contractorName || 'Not stated', detail: priceLabel(report.lowest || {}) },
    { label: 'Strongest written warranty', name: report.warrantyLeader?.contractorName || 'Not stated', detail: fieldValue(report.warrantyLeader || {}, 'warranty_length') },
    { label: 'Fewest questions', name: [...report.contractors].sort((a, b) => a.missingCount - b.missingCount)[0]?.contractorName || 'Not stated', detail: 'Fewest missing items in the written proposal.' }
  ];
  const winner = report.top || report.contractors[0];
  const warrantyTableColumns = [{ key: 'label', label: 'Warranty item' }, ...report.warrantyColumns];
  const guaranteeTableColumns = [{ key: 'label', label: 'Promise' }, ...report.warrantyColumns];
  const costTableColumns = [{ key: 'label', label: 'Cost item' }, ...report.warrantyColumns];
  const warrantySummaryRows = report.contractors.map((contractor) => ({
    company: contractor.contractorName,
    strength: contractor.warranties?.[0]?.length || fieldValue(contractor, 'warranty_length'),
    concern: fieldValue(contractor, 'contractor_labor_warranty') === 'Not stated' ? 'Labor coverage needs clarification.' : 'Confirm exclusions and transfer terms in writing.'
  }));
  const questionsRows = report.questionPacks.map((pack) => ({
    company: `${pack.contractorName} - ${pack.total} question${pack.total === 1 ? '' : 's'}`,
    questions: pack.groups?.flatMap((group) => group.questions || []).slice(0, 6).map((item) => item.question).join(' | ') || 'No additional questions.'
  }));

  return <div className={styles.page}>
    <ReportHeader company={{ name: 'PRO TRENCHLESS', tagline: 'SEWER & DRAIN EXPERTS · EVIDENCE BEFORE EXPENSE' }} badge={{ stat: '86+ YEARS', caption: 'MASTER PLUMBER', label: 'EXPERIENCE' }} />
    <main className={styles.main}>
      <MetaStrip preparedFor={report.customer.customerName || 'Customer'} address={address || 'Not stated'} reportDate={report.reportDate} reportId={report.reportId} />
      <PageTitle title="Your Sewer Proposal Comparison" subtitle="We compared each company the same way. Then we compared the choices inside each company." />
      <section className={styles.section}><ComparisonCards items={report.items} /></section>
      <section className={styles.section}><ResultBanner tone="positive" tag="Best mix of value + clarity" title={`${winner?.contractorName || 'Not stated'} - ${winner?.proposedMethod || 'Recommended option'}`} body={winner?.documentNotes || 'The highest-scoring proposal has the strongest documented balance in this comparison.'} highlight="This is not necessarily the cheapest choice. It is the strongest written balance in this sample." /></section>
      <section className={styles.section}><WinnersRow items={winnerItems} /></section>
      <PageTitle title="Why the Scores Are Different" subtitle="Every company is graded on the same criteria. This grades the written proposal, not the quality of work that has not happened yet." />
      <section className={styles.section}><DataTable columns={columns} rows={report.scoreRows} totals={totals} /></section>
      <section className={styles.section}><DataTable columns={featureColumns} rows={report.featureRows} statusColorFn={(value, row, key) => key.startsWith('company') ? statusTone(fieldStatus(report.contractors[Number(key.replace('company', ''))] || {}, featureDefinitionsFor(row.matter))) : ''} /></section>
      <section className={styles.section}><StatusKey items={[{ label: 'Clearly included', color: '#2E9B5C', description: 'Written as included.' }, { label: 'Clearly excluded', color: '#C13B45', description: 'Written as not included.' }, { label: 'Not stated', color: '#9CA3AF', description: 'Not found in the proposal.' }, { label: 'Needs clarification', color: '#E0932E', description: 'The words are not clear.' }]} /></section>
      <section className={styles.section}><DataTable columns={[{ key: 'company', label: 'Company' }, { key: 'strength', label: 'Biggest strength' }, { key: 'concern', label: 'Biggest concern' }]} rows={report.contractors.map((contractor) => ({ company: contractor.contractorName, strength: contractor.documentNotes || contractor.labels?.[0] || 'Proposal details reviewed.', concern: `${contractor.missingCount || 0} items need clarification.` }))} /></section>
      <PageTitle title="Good, Better, and Best" subtitle="One company can offer several choices. This view shows what each upgrade buys and what still needs an answer." />
      <section className={styles.section}><TierCards items={report.contractors.map((contractor, index) => ({ tier: ['Good', 'Better', 'Best'][index] || `Option ${index + 1}`, packageName: contractor.proposedMethod || 'Documented option', price: priceLabel(contractor), ribbon: contractor.labels?.[0] || 'Proposal option', accent: ['blue', 'green', 'purple'][index] || 'blue', includes: contractor.repairOptions?.[0]?.advantages ? [contractor.repairOptions[0].advantages] : ['See written proposal details'], watchFor: contractor.repairOptions?.[0]?.limitations ? [contractor.repairOptions[0].limitations] : ['Confirm missing terms in writing'] }))} /></section>
      <section className={styles.section}><DataTable columns={[{ key: 'upgrade', label: 'Upgrade' }, { key: 'cost', label: 'Extra cost' }, { key: 'buys', label: 'What the extra money buys' }]} rows={[]} /></section>
      <PageTitle title="Warranty Comparison" subtitle="A warranty tells you what may be fixed after the job is done. The words matter more than the headline." />
      <section className={styles.section}><DataTable columns={warrantyTableColumns} rows={report.warrantyEvidence} statusColorFn={(value) => statusToneFromText(value)} /></section>
      <section className={styles.section}><h2 className={styles.subheading}>What the Warranty Really Means</h2><DataTable columns={[{ key: 'company', label: 'Company' }, { key: 'strength', label: 'Coverage summary' }, { key: 'concern', label: 'What still needs an answer' }]} rows={warrantySummaryRows} /></section>
      <section className={styles.section}><ResultBanner tone="warning" tag="Lifetime is not enough" title="Read the warranty terms, not just the headline." body="A lifetime product warranty may cover only the pipe material." highlight="It may not pay for labor, digging, access, restoration, or a failed connection." /></section>
      <PageTitle title="Service Guarantees" subtitle="A guarantee is a service promise. A useful promise says what the company will do if something goes wrong." />
      <section className={styles.section}><h2 className={styles.subheading}>Satisfaction Guarantee</h2><DataTable columns={guaranteeTableColumns} rows={report.guaranteeEvidence} statusColorFn={(value) => statusToneFromText(value)} /></section>
      <section className={styles.section}><h2 className={styles.subheading}>Possible Extra-Cost Risk</h2><p className={styles.note}>This does not mean extra charges will happen. It shows where the written price has gaps.</p><DataTable columns={costTableColumns} rows={[...report.costEvidence, { label: 'Final price risk', ...Object.fromEntries(report.contractors.map((contractor, index) => [`company${index}`, riskLabel(contractor)])) }]} statusColorFn={(value) => statusToneFromText(value)} /></section>
      <PageTitle title="Questions to Ask Before You Sign" subtitle="Ask for the answers in writing. The answers could change the price, protection, or final choice." />
      <section className={styles.section}><DataTable columns={[{ key: 'company', label: 'Company' }, { key: 'questions', label: 'Questions' }]} rows={questionsRows} /></section>
      <section className={styles.section}><h2 className={styles.subheading}>Your Final Result</h2><div className={styles.finalGrid}><div><span>Best documented company</span><strong>{report.top?.contractorName || 'Not stated'}</strong></div><div><span>Best documented option</span><strong>{report.top?.proposedMethod || 'Not stated'}</strong></div><div><span>Lowest stated price</span><strong>{report.lowest?.contractorName || 'Not stated'} - {priceLabel(report.lowest || {})}</strong></div><div><span>Strongest written warranty</span><strong>{report.warrantyLeader?.contractorName || 'Not stated'}</strong></div><div><span>Lowest possible extra-cost risk</span><strong>{[...report.contractors].sort((a, b) => a.warningCount - b.warningCount)[0]?.contractorName || 'Not stated'}</strong></div></div><p className={styles.finalCopy}>{report.top?.contractorName || 'The highest-scoring company'} ranked highest because the written proposal gives the best documented balance of clear work, price protection, permits, restoration, camera proof, written records, and customer protection.</p></section>
      <section className={styles.inspection}><div><h2>Would You Like the Pipe Checked Before You Decide?</h2><p>A proposal tells you what a company plans to do. A sewer camera can help show what is really happening inside the pipe.</p><ul><li>See where the problem is</li><li>Check how much pipe is affected</li><li>See if the proposed repair matches the visible problem</li><li>Ask whether a smaller or less disruptive repair may work</li></ul><strong>No obligation. Recommendations are based on visible pipe conditions.</strong></div><aside><b>FREE CAMERA<br />INSPECTION</b><strong>484-801-7242</strong><span>admin@protrenchless.com</span><a href="https://answers.protrenchless.com/#lead-form">REQUEST MY INSPECTION</a></aside></section>
      <section className={styles.important}><h2>Important Note</h2><p>This report is based only on the proposals and information provided. “Not stated” does not mean the company will not provide the item. It means the item was not clearly written and should be confirmed before signing. This report grades proposal clarity and customer protection. It does not verify workmanship, pipe condition, licensing, insurance, or whether a repair is needed unless separate proof is provided.</p></section>
      <div className={styles.actions}><button type="button" className="btn secondary" onClick={onStartOver}>Start a new comparison</button></div>
    </main>
    <ReportFooter company="PRO TRENCHLESS SERVICES" phone="484-801-7242" email="admin@protrenchless.com" website="protrenchless.com" disclaimer={analysis.disclaimer} />
  </div>;
}

function statusToneFromText(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('included') || text.includes('clear') || text.includes('yes') || text.includes('contractor') || text === 'low') return 'green';
  if (text.includes('not stated') || text.includes('not clear') || text.includes('excluded') || text === 'high') return text === 'high' ? 'red' : 'gray';
  if (text.includes('clarif') || text.includes('unclear') || text === 'medium') return 'orange';
  return '';
}

function featureDefinitionsFor(label) {
  return ({
    'Exact repair and footage': 'repair_method',
    'Who will do the work': 'employees_or_subs',
    'Permits and inspection': 'permits_included',
    'Digging, backfill, compaction': 'backfill_included',
    'Yard or surface repair': 'yard_restoration',
    'Before and after camera proof': 'camera_video_provided',
    'Written job records': 'completion_report',
    'Parts and labor warranty': 'contractor_labor_warranty',
    'Written approval for extra work': 'written_change_order',
    'Service guarantees explained': 'satisfaction_guarantee'
  }[label] || '');
}
