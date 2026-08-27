/**
 * Scoring, normalization, and derived-insight helpers for the
 * Three-Quote Sewer Estimate Comparison Tool.
 *
 * Shared by the React UI and the Node backend. Plain ESM only.
 *
 * Scoring principles enforced here:
 *  - Price is capped at 5% of the total and measures TRANSPARENCY, not cheapness.
 *  - Contractor identity is never an input. Only extracted document evidence is.
 *  - Every contractor runs through the identical pipeline.
 */

import {
  STATUS,
  repairMethods,
  allFields,
  allFieldKeys,
  categoryById,
  comparisonCategories,
  contractorLabels,
  fieldByKey,
  isStatus,
  keyHomeownerQuestions,
  scoreForStatus,
  scoreGroups,
  statusMeta
} from './comparisonConfig.js';

/* ------------------------------------------------------------------ */
/* Normalization                                                       */
/* ------------------------------------------------------------------ */

function clampString(value, max = 1200) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * Turn whatever the AI returned into the complete, guaranteed-shaped field set.
 * Anything the AI did not explicitly report becomes `not_stated` — never inferred.
 */
export function normalizeFields(rawFields = []) {
  const reported = new Map();

  for (const raw of Array.isArray(rawFields) ? rawFields : []) {
    const key = clampString(raw?.key || raw?.k, 80);
    if (!key || !fieldByKey[key]) continue;

    const rawStatus = clampString(raw?.status || raw?.s, 40).toLowerCase();
    const status = isStatus(rawStatus) ? rawStatus : normalizeShortStatus(rawStatus);
    if (!status) continue;

    const confidence = toNumberOrNull(raw?.confidence ?? raw?.c);

    reported.set(key, {
      status,
      value: clampString(raw?.value ?? raw?.v, 400),
      sourceText: clampString(raw?.sourceText ?? raw?.t, 700),
      sourcePage: toNumberOrNull(raw?.sourcePage ?? raw?.p),
      confidence: confidence === null ? null : Math.min(1, Math.max(0, confidence > 1 ? confidence / 100 : confidence))
    });
  }

  return allFields.map((field) => {
    const found = reported.get(field.key);
    return {
      key: field.key,
      label: field.label,
      category: field.category,
      categoryLabel: field.categoryLabel,
      group: field.group,
      transparency: field.transparency,
      highlight: Boolean(field.highlight),
      hint: field.hint || '',
      clarificationQuestion: field.q || '',
      status: found?.status || STATUS.NOT_STATED,
      value: found?.value || '',
      sourceText: found?.sourceText || '',
      sourcePage: found?.sourcePage ?? null,
      confidence: found?.confidence ?? null
    };
  });
}

function normalizeShortStatus(value) {
  const map = {
    i: STATUS.INCLUDED,
    included: STATUS.INCLUDED,
    e: STATUS.EXCLUDED,
    excluded: STATUS.EXCLUDED,
    n: STATUS.NOT_STATED,
    'not stated': STATUS.NOT_STATED,
    c: STATUS.NEEDS_CLARIFICATION,
    unclear: STATUS.NEEDS_CLARIFICATION,
    ambiguous: STATUS.NEEDS_CLARIFICATION
  };
  return map[value] || null;
}

/**
 * Keep the method label short enough for a card. If the model returned a full
 * sentence, prefer a known method name found inside it rather than truncating
 * mid-word.
 */
function normalizeMethod(value) {
  const text = clampString(value, 300);
  if (!text) return '';
  if (text.length <= 48) return text;

  const lower = text.toLowerCase();
  const candidates = repairMethods.filter((method) => method !== 'Other');
  const match =
    candidates.find((method) => lower.includes(method.toLowerCase())) ||
    candidates.find((method) => lower.includes(method.toLowerCase().replace(' pipe lining', '')));
  if (match) return match;

  return `${text.slice(0, 45).trimEnd()}…`;
}

export function normalizeWarranties(rawWarranties = []) {
  if (!Array.isArray(rawWarranties)) return [];
  return rawWarranties.slice(0, 12).map((item) => ({
    type: clampString(item?.type, 120) || 'Unspecified warranty',
    length: clampString(item?.length, 120),
    prorated: clampString(item?.prorated, 120),
    transferable: clampString(item?.transferable, 160),
    transferFee: clampString(item?.transferFee, 120),
    laborIncluded: clampString(item?.laborIncluded, 200),
    materialsIncluded: clampString(item?.materialsIncluded, 200),
    exclusions: clampString(item?.exclusions, 600),
    sourceText: clampString(item?.sourceText, 500)
  }));
}

export function normalizeRepairOptions(rawOptions = []) {
  if (!Array.isArray(rawOptions)) return [];
  return rawOptions.slice(0, 8).map((item, index) => ({
    id: `option-${index + 1}`,
    name: clampString(item?.name, 120) || `Option ${index + 1}`,
    method: clampString(item?.method, 160),
    price: clampString(item?.price, 80),
    expectedServiceLife: clampString(item?.expectedServiceLife, 160),
    warranty: clampString(item?.warranty, 240),
    advantages: clampString(item?.advantages, 500),
    limitations: clampString(item?.limitations, 500),
    whyRecommended: clampString(item?.whyRecommended, 500),
    fitForDocumentedCondition: clampString(item?.fitForDocumentedCondition, 500)
  }));
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

/**
 * Score one contractor from its normalized fields.
 * Returns { overallScore, groupScores: [{id,label,weight,score,earned,possible}] }
 */
export function scoreContractor(fields = []) {
  const buckets = new Map(scoreGroups.map((group) => [group.id, { earned: 0, possible: 0 }]));

  for (const field of fields) {
    const bucket = buckets.get(field.group);
    if (!bucket) continue;
    bucket.earned += scoreForStatus(field.status, { transparency: field.transparency });
    bucket.possible += 1;
  }

  let overall = 0;
  const groupScores = scoreGroups.map((group) => {
    const bucket = buckets.get(group.id) || { earned: 0, possible: 0 };
    const ratio = bucket.possible > 0 ? bucket.earned / bucket.possible : 0;
    overall += ratio * group.weight;
    return {
      id: group.id,
      label: group.label,
      weight: group.weight,
      score: Math.round(ratio * 100),
      earned: Number(bucket.earned.toFixed(2)),
      possible: bucket.possible
    };
  });

  return { overallScore: Math.round(overall), groupScores };
}

/** Per-display-category completeness percentage, used by the accordion headers. */
export function scoreCategories(fields = []) {
  const byCategory = new Map(comparisonCategories.map((category) => [category.id, { earned: 0, possible: 0 }]));

  for (const field of fields) {
    const bucket = byCategory.get(field.category);
    if (!bucket) continue;
    bucket.earned += scoreForStatus(field.status, { transparency: field.transparency });
    bucket.possible += 1;
  }

  return Object.fromEntries(
    comparisonCategories.map((category) => {
      const bucket = byCategory.get(category.id);
      const ratio = bucket.possible > 0 ? bucket.earned / bucket.possible : 0;
      return [category.id, Math.round(ratio * 100)];
    })
  );
}

export function countStatuses(fields = []) {
  const counts = {
    [STATUS.INCLUDED]: 0,
    [STATUS.EXCLUDED]: 0,
    [STATUS.NOT_STATED]: 0,
    [STATUS.NEEDS_CLARIFICATION]: 0
  };
  for (const field of fields) {
    if (counts[field.status] !== undefined) counts[field.status] += 1;
  }
  return counts;
}

/* ------------------------------------------------------------------ */
/* Contractor assembly                                                 */
/* ------------------------------------------------------------------ */

/**
 * Build the fully-derived contractor object the dashboard renders from.
 * `raw` is the per-contractor payload returned by /api/estimate-comparison.
 */
export function buildContractor(raw = {}, index = 0) {
  const fields = normalizeFields(raw.fields);
  const { overallScore, groupScores } = scoreContractor(fields);
  const categoryScores = scoreCategories(fields);
  const statusCounts = countStatuses(fields);

  const totalPriceField = fields.find((field) => field.key === 'total_price');
  const methodField = fields.find((field) => field.key === 'repair_method');

  const totalPrice = toNumberOrNull(raw.totalPrice) ?? toNumberOrNull(totalPriceField?.value);

  return {
    id: raw.id || `contractor-${index + 1}`,
    slot: index + 1,
    contractorName: clampString(raw.contractorName, 160) || `Contractor ${index + 1}`,
    fileName: clampString(raw.fileName, 200),
    analyzed: raw.analyzed !== false,
    extractionMode: clampString(raw.extractionMode, 60),
    documentNotes: clampString(raw.documentNotes, 900),
    proposedMethod: normalizeMethod(raw.proposedMethod) || normalizeMethod(methodField?.value) || 'Not stated',
    totalPrice,
    fields,
    warranties: normalizeWarranties(raw.warranties),
    repairOptions: normalizeRepairOptions(raw.repairOptions),
    overallScore,
    groupScores,
    categoryScores,
    statusCounts,
    warningCount: statusCounts[STATUS.EXCLUDED] + statusCounts[STATUS.NEEDS_CLARIFICATION],
    missingCount: statusCounts[STATUS.NOT_STATED],
    labels: []
  };
}

/* ------------------------------------------------------------------ */
/* Warranty summary line                                               */
/* ------------------------------------------------------------------ */

export function warrantySummary(contractor) {
  const get = (key) => contractor.fields.find((field) => field.key === key);
  const parts = [];

  const length = get('warranty_length');
  if (length?.status === STATUS.INCLUDED && length.value) parts.push(length.value);

  const labor = get('contractor_labor_warranty');
  if (labor?.status === STATUS.INCLUDED) parts.push('labor covered');
  else if (labor?.status === STATUS.EXCLUDED) parts.push('labor excluded');
  else parts.push('labor not stated');

  const transferable = get('warranty_transferable');
  if (transferable?.status === STATUS.INCLUDED) parts.push('transferable');
  else if (transferable?.status === STATUS.EXCLUDED) parts.push('not transferable');
  else parts.push('transfer not stated');

  return parts.join(' · ');
}

/* ------------------------------------------------------------------ */
/* Labels — only applied when the data actually supports them          */
/* ------------------------------------------------------------------ */

function bestBy(contractors, selector) {
  let best = null;
  let bestValue = -Infinity;
  let tied = false;

  for (const contractor of contractors) {
    const value = selector(contractor);
    if (value === null || value === undefined || !Number.isFinite(value)) continue;
    if (value > bestValue) {
      bestValue = value;
      best = contractor;
      tied = false;
    } else if (value === bestValue) {
      tied = true;
    }
  }

  return tied || !best ? null : { contractor: best, value: bestValue };
}

/**
 * Assigns descriptive labels. Deliberately never assigns a "Winner" label —
 * every label describes a documented property of the estimate, not a verdict.
 * Mutates and returns the contractor list.
 */
export function assignLabels(contractors = []) {
  contractors.forEach((contractor) => {
    contractor.labels = [];
  });

  if (contractors.length < 2) return contractors;

  const groupScore = (contractor, id) => contractor.groupScores.find((group) => group.id === id)?.score ?? null;

  const mostComplete = bestBy(contractors, (c) => c.overallScore);
  if (mostComplete) mostComplete.contractor.labels.push(contractorLabels.MOST_COMPLETE);

  const strongestWarranty = bestBy(contractors, (c) => groupScore(c, 'warranty'));
  if (strongestWarranty && strongestWarranty.value > 0) {
    strongestWarranty.contractor.labels.push(contractorLabels.STRONGEST_WARRANTY);
  }

  const clearestScope = bestBy(contractors, (c) => groupScore(c, 'scope'));
  if (clearestScope && clearestScope.value > 0) {
    clearestScope.contractor.labels.push(contractorLabels.CLEAREST_SCOPE);
  }

  const priced = contractors.filter((c) => Number.isFinite(c.totalPrice) && c.totalPrice > 0);
  if (priced.length >= 2) {
    const lowest = bestBy(priced, (c) => -c.totalPrice);
    if (lowest) lowest.contractor.labels.push(contractorLabels.LOWEST_PRICE);
  }

  const mostMissing = bestBy(contractors, (c) => c.missingCount);
  if (mostMissing && mostMissing.value > 0) {
    mostMissing.contractor.labels.push(contractorLabels.MOST_MISSING);
  }

  return contractors;
}

/* ------------------------------------------------------------------ */
/* Key homeowner questions                                             */
/* ------------------------------------------------------------------ */

const statusRank = {
  [STATUS.EXCLUDED]: 0,
  [STATUS.NOT_STATED]: 1,
  [STATUS.NEEDS_CLARIFICATION]: 2,
  [STATUS.INCLUDED]: 3
};

/**
 * Answers each of the 12 questions per contractor by taking the weakest
 * supporting field — a chain is only as documented as its softest link.
 */
export function buildKeyQuestionMatrix(contractors = []) {
  return keyHomeownerQuestions.map((question) => ({
    id: question.id,
    question: question.question,
    answers: contractors.map((contractor) => {
      // An entry may be a single key (required) or an array of keys (any-of —
      // e.g. a combined "parts and labor" warranty documents labor coverage
      // just as well as a standalone labor warranty row would).
      const supporting = question.fields
        .map((entry) => {
          if (!Array.isArray(entry)) return contractor.fields.find((field) => field.key === entry);
          const candidates = entry.map((key) => contractor.fields.find((field) => field.key === key)).filter(Boolean);
          if (!candidates.length) return null;
          return candidates.reduce((best, field) => (statusRank[field.status] > statusRank[best.status] ? field : best));
        })
        .filter(Boolean);

      if (!supporting.length) {
        return { contractorId: contractor.id, status: STATUS.NOT_STATED, drivingField: null };
      }

      const weakest = supporting.reduce((worst, field) =>
        statusRank[field.status] < statusRank[worst.status] ? field : worst
      );

      return {
        contractorId: contractor.id,
        status: weakest.status,
        drivingField: { key: weakest.key, label: weakest.label, sourceText: weakest.sourceText, value: weakest.value }
      };
    })
  }));
}

/* ------------------------------------------------------------------ */
/* Risk derivation (deterministic fallback + AI merge)                 */
/* ------------------------------------------------------------------ */

/**
 * Fields that carry the most financial or warranty consequence when they are
 * missing. Severity reflects documented consequence, not drama.
 */
const riskWeights = [
  {
    key: 'contractor_labor_warranty',
    // A combined parts-and-labor warranty documents labor coverage just as well.
    satisfiedBy: ['parts_and_labor_warranty', 'contractor_transferable_labor_material_protection'],
    severity: 'high',
    why: 'A manufacturer product warranty can replace the product while leaving you to pay for the labor, excavation, and reinstallation needed to use it.'
  },
  {
    key: 'warranty_transferable',
    satisfiedBy: ['contractor_transferable_labor_material_protection'],
    severity: 'high',
    why: 'If the warranty ends when you sell, it has no value to a future buyer and no value to you at closing.'
  },
  { key: 'warranty_excavation_covered', severity: 'high', why: 'Warranty repairs on a buried line almost always require digging. If excavation is not covered, the claim can cost more than the original repair.' },
  { key: 'driveway_restoration', severity: 'high', why: 'Driveway replacement is one of the largest surprise costs in sewer work and is frequently outside the quoted price.' },
  { key: 'concrete_restoration', severity: 'high', why: 'Concrete restoration is commonly excluded, and the homeowner discovers it only after the trench is backfilled.' },
  { key: 'subcontractor_workmanship_responsibility', severity: 'high', why: 'If responsibility for subcontracted workmanship is not written down, a future defect can turn into a dispute between two companies with you in the middle.' },
  { key: 'additional_work_pricing_method', severity: 'high', why: 'Without defined pricing for additional work, extra costs are set after the excavation is already open and you have little leverage.' },
  { key: 'price_additional_excavation', severity: 'high', why: 'Additional excavation is one of the most common change orders on sewer projects.' },
  { key: 'total_footage_repaired', severity: 'high', why: 'If the quoted footage is not stated, there is no written definition of how much pipe the price actually covers.' },
  { key: 'written_approval_required', satisfiedBy: ['work_stops_until_approval'], severity: 'medium', why: 'Without a written approval requirement, additional charges can be incurred before you agree to them.' },
  { key: 'private_utility_locating', severity: 'medium', why: 'Public 811 marking does not cover private lines. Damage to an unmarked private line can become your cost.' },
  { key: 'after_camera_inspection', severity: 'medium', why: 'Without an after-camera inspection, there is no objective record that the finished line is correct.' },
  { key: 'written_completion_report', severity: 'medium', why: 'A written verification report is the document a future buyer, inspector, or insurer will ask for.' },
  { key: 'plumbing_permit', severity: 'medium', why: 'Unpermitted sewer work can create problems at resale and can void some warranty and insurance coverage.' },
  { key: 'landscaping_restoration', severity: 'medium', why: 'Landscaping restoration is often assumed by homeowners and excluded by contractors.' },
  { key: 'rock_excavation_included', severity: 'medium', why: 'Rock charges are a common mid-project cost increase when they are not defined up front.' },
  { key: 'exclusion_hidden_conditions', severity: 'medium', why: 'How hidden conditions are handled determines who absorbs the cost of the unexpected.' },
  { key: 'installer_matches_named_contractor', severity: 'medium', why: 'The company you sign with is not always the company that performs the installation.' },
  { key: 'existing_pipe_suitable_for_method', severity: 'medium', why: 'A repair method that does not match the documented pipe condition is the most expensive kind of mistake.' },
  { key: 'change_order_terms', severity: 'low', why: 'Written change-order terms set the rules before there is a disagreement.' },
  { key: 'service_interruption', severity: 'low', why: 'Knowing how long the sewer will be out of service affects whether you need to make other arrangements.' }
];

function riskTitleFor(field, status) {
  if (status === STATUS.EXCLUDED) return `${field.label} is excluded`;
  if (status === STATUS.NEEDS_CLARIFICATION) return `${field.label} is unclear`;
  return `${field.label} is not stated`;
}

export function deriveRisks(contractors = []) {
  const risks = [];

  for (const contractor of contractors) {
    for (const weight of riskWeights) {
      const field = contractor.fields.find((item) => item.key === weight.key);
      if (!field) continue;
      if (field.status === STATUS.INCLUDED) continue;

      // An equivalent row already documents this in writing — not a risk.
      const alreadyCovered = (weight.satisfiedBy || []).some(
        (key) => contractor.fields.find((item) => item.key === key)?.status === STATUS.INCLUDED
      );
      if (alreadyCovered) continue;

      // A clearly disclosed exclusion is a lower-severity, known cost than silence.
      let severity = weight.severity;
      if (field.status === STATUS.EXCLUDED && severity === 'high') severity = 'medium';
      if (field.status === STATUS.NEEDS_CLARIFICATION && severity === 'high') severity = 'medium';

      risks.push({
        id: `${contractor.id}-${weight.key}`,
        contractorId: contractor.id,
        contractorName: contractor.contractorName,
        title: riskTitleFor(field, field.status),
        description: weight.why,
        severity,
        status: field.status,
        category: categoryById[field.category]?.label || field.category,
        fieldKey: field.key,
        suggestedQuestion: field.clarificationQuestion,
        sourceText: field.sourceText
      });
    }
  }

  const severityOrder = { high: 0, medium: 1, low: 2 };
  return risks.sort((a, b) => {
    const bySeverity = severityOrder[a.severity] - severityOrder[b.severity];
    if (bySeverity !== 0) return bySeverity;
    // Prefer surfacing silence over disclosed exclusions at equal severity.
    const statusPriority = { [STATUS.NOT_STATED]: 0, [STATUS.NEEDS_CLARIFICATION]: 1, [STATUS.EXCLUDED]: 2 };
    return (statusPriority[a.status] ?? 3) - (statusPriority[b.status] ?? 3);
  });
}

/** Pick the five biggest risks while spreading coverage across contractors. */
export function topRisks(contractors = [], aiRisks = [], limit = 5) {
  const derived = deriveRisks(contractors);
  const byField = new Map(derived.map((risk) => [`${risk.contractorId}::${risk.fieldKey}`, risk]));

  // AI risks only enrich derived risks — they can reword and re-rank, never invent.
  for (const aiRisk of Array.isArray(aiRisks) ? aiRisks : []) {
    const key = `${clampString(aiRisk?.contractorId, 60)}::${clampString(aiRisk?.fieldKey, 80)}`;
    const match = byField.get(key);
    if (!match) continue;
    if (aiRisk.description) match.description = clampString(aiRisk.description, 500);
    if (aiRisk.suggestedQuestion) match.suggestedQuestion = clampString(aiRisk.suggestedQuestion, 400);
    if (['high', 'medium', 'low'].includes(aiRisk.severity)) match.severity = aiRisk.severity;
    match.aiRanked = true;
  }

  const ranked = [...byField.values()].sort((a, b) => {
    if (Boolean(b.aiRanked) !== Boolean(a.aiRanked)) return b.aiRanked ? 1 : -1;
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  // Round-robin across contractors so one weak estimate cannot monopolize the list.
  const perContractor = new Map();
  for (const risk of ranked) {
    if (!perContractor.has(risk.contractorId)) perContractor.set(risk.contractorId, []);
    perContractor.get(risk.contractorId).push(risk);
  }

  const picked = [];
  const queues = [...perContractor.values()];
  let guard = 0;
  while (picked.length < limit && queues.some((queue) => queue.length) && guard < 200) {
    for (const queue of queues) {
      if (picked.length >= limit) break;
      const next = queue.shift();
      if (next) picked.push(next);
    }
    guard += 1;
  }

  return picked.slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Contractor question packs                                           */
/* ------------------------------------------------------------------ */

const HIGH_PRIORITY_KEYS = new Set(riskWeights.map((weight) => weight.key));

/**
 * Every Not Stated / Needs Clarification field becomes an optional question.
 * That is a long list by design, so each one is tagged: `high` for rows that
 * carry real financial or warranty consequence, `normal` for the rest. The UI
 * leads with the high-priority set and keeps the remainder behind a toggle.
 */
export function buildContractorQuestions(contractors = []) {
  return contractors.map((contractor) => {
    const byCategory = new Map();

    for (const field of contractor.fields) {
      if (field.status !== STATUS.NOT_STATED && field.status !== STATUS.NEEDS_CLARIFICATION) continue;
      if (!field.clarificationQuestion) continue;
      if (!byCategory.has(field.category)) byCategory.set(field.category, []);
      byCategory.get(field.category).push({
        fieldKey: field.key,
        label: field.label,
        status: field.status,
        question: field.clarificationQuestion,
        priority: field.highlight || HIGH_PRIORITY_KEYS.has(field.key) ? 'high' : 'normal'
      });
    }

    const groups = comparisonCategories
      .filter((category) => byCategory.has(category.id))
      .map((category) => ({
        categoryId: category.id,
        categoryLabel: category.label,
        questions: byCategory
          .get(category.id)
          .sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'high' ? -1 : 1))
      }));

    const total = groups.reduce((sum, group) => sum + group.questions.length, 0);
    const priorityTotal = groups.reduce(
      (sum, group) => sum + group.questions.filter((question) => question.priority === 'high').length,
      0
    );
    return { contractorId: contractor.id, contractorName: contractor.contractorName, total, priorityTotal, groups };
  });
}

/** Flatten one contractor's question pack into copyable plain text. */
export function questionsToPlainText(pack, contractorName, { priorityOnly = false } = {}) {
  const lines = [`Questions for ${contractorName}`, ''];
  for (const group of pack.groups) {
    const questions = priorityOnly ? group.questions.filter((question) => question.priority === 'high') : group.questions;
    if (!questions.length) continue;
    lines.push(group.categoryLabel.toUpperCase());
    questions.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.question}`);
    });
    lines.push('');
  }
  lines.push('Please answer these in writing and attach the answers to the estimate before I sign.');
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Deterministic summary fallback                                      */
/* ------------------------------------------------------------------ */

export function buildFallbackSummary(contractors = []) {
  if (!contractors.length) return 'No estimates were analyzed.';
  if (contractors.length === 1) {
    const only = contractors[0];
    return `Based on the written estimate from ${only.contractorName}, ${only.missingCount} of ${only.fields.length} comparison items are not addressed in the document and ${only.statusCounts[STATUS.NEEDS_CLARIFICATION]} are worded ambiguously. Uploading two more estimates would make the comparison far more useful. Before making a decision, clarify the items flagged below in writing.`;
  }

  const sorted = [...contractors].sort((a, b) => b.overallScore - a.overallScore);
  const mostComplete = sorted[0];
  const warrantyLeader = [...contractors].sort(
    (a, b) => (b.groupScores.find((g) => g.id === 'warranty')?.score || 0) - (a.groupScores.find((g) => g.id === 'warranty')?.score || 0)
  )[0];
  const priced = contractors.filter((c) => Number.isFinite(c.totalPrice) && c.totalPrice > 0);
  const cheapest = priced.length ? [...priced].sort((a, b) => a.totalPrice - b.totalPrice)[0] : null;

  const parts = [
    `Based on the written estimates, the most complete documented proposal is ${mostComplete.contractorName}, which addresses the largest share of the comparison items in writing.`,
    `The estimate with the strongest documented warranty protection is ${warrantyLeader.contractorName}.`
  ];

  if (cheapest) {
    parts.push(
      `${cheapest.contractorName} has the lowest initial price at $${cheapest.totalPrice.toLocaleString()}, but a lower price only means less money today — it does not indicate what the finished scope includes.`
    );
  }

  parts.push('Before making a decision, clarify the items listed below with each contractor and ask for the answers in writing.');
  return parts.join(' ');
}

export { STATUS, statusMeta, allFieldKeys, comparisonCategories, keyHomeownerQuestions, scoreGroups };
