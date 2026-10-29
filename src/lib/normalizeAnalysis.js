import { assignLabels, buildContractor, buildContractorQuestions, buildFallbackSummary, buildKeyQuestionMatrix, topRisks } from './comparisonScoring.js';

/**
 * The server already returns fully-scored contractors using the same shared
 * modules the UI imports. This rebuilds anything missing so the dashboard can
 * never receive a half-shaped payload — e.g. if an older server is deployed.
 */
export function normalizeAnalysis(data = {}) {
  const hasScores = Array.isArray(data.contractors) && data.contractors.every((contractor) => Array.isArray(contractor.groupScores));

  const contractors = hasScores
    ? data.contractors
    : assignLabels((data.contractors || []).map((contractor, index) => buildContractor(contractor, index)));

  return {
    contractors,
    customer: data.customer || {},
    reportId: data.reportId || '',
    reportDate: data.reportDate || data.analyzedAt || '',
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
