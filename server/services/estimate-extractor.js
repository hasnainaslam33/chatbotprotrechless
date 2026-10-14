/**
 * AI extraction + synthesis for the Three-Quote Sewer Estimate Comparison Tool.
 *
 * Reuses the existing OpenAI Responses integration and the existing upload
 * pipeline (server/routes/uploads.js) — nothing new is introduced on the
 * infrastructure side. If no API key is configured, or a call fails, every
 * field degrades to `not_stated` so the UI still renders honestly rather than
 * inventing scope.
 */

import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';
import { getClient, extractOutputText, parseJsonFromText, buildMultimodalContent } from './openai-client.js';
import { findUpload } from './storage.js';
import { cleanText } from '../utils/safe.js';
import { comparisonCategories, fieldByKey, statusMeta, STATUS } from '../../src/lib/comparisonConfig.js';

const STATUS_CODES = { I: STATUS.INCLUDED, E: STATUS.EXCLUDED, C: STATUS.NEEDS_CLARIFICATION, N: STATUS.NOT_STATED };

/* ------------------------------------------------------------------ */
/* Prompts                                                             */
/* ------------------------------------------------------------------ */

function buildFieldCatalog() {
  return comparisonCategories
    .map((category) => {
      const rows = category.fields.map((field) => `  ${field.key} = ${field.label}`).join('\n');
      return `## ${category.label}\n${rows}`;
    })
    .join('\n\n');
}

const FIELD_CATALOG = buildFieldCatalog();

const EXTRACTION_INSTRUCTIONS = `You are a document extraction engine for the Pro Trenchless AI Sewer Decision Center. You read a homeowner's sewer repair estimate and report ONLY what the document actually says.

You are NOT an advisor here. You do not recommend, rank, or praise any contractor. You extract.

ABSOLUTE RULES — violating any of these makes the output worthless:
1. If something is not explicitly written in the estimate document, it is NOT included. Report nothing for it.
2. Never infer, assume, complete, or "fill in" industry-standard practice. A reasonable assumption is still a fabrication.
3. Verbal promises, marketing slogans, and website claims are not written scope.
4. Never infer warranty coverage from generic phrases such as "lifetime warranty", "manufacturer warranty", "industry-leading warranty", "fully guaranteed", or "guaranteed work". Those phrases alone tell you NOTHING about labor coverage, materials, transferability, excavation, removal, reinstallation, diagnostics, restoration, exclusions, or duration. Each of those must be separately written to be reported.
5. "Backfill included" NEVER means finished surface restoration is included. Never map one to the other.
6. Contractor identity, brand, reputation, and company name must not influence any status. Apply identical strictness to every document.
7. Report ownership_accountability only when the document explicitly states who owns the company (for example "family-owned", "locally owned and operated", "independently owned", "a subsidiary of X", "a franchise of X"). Use status "I", the ownership wording as the value, and the exact sentence as the source text. Never infer ownership from a license number, address, phone number, service area, insurance, or branding — omit the field instead. Ownership is also researched separately using public web sources.

STATUS CODES — assign exactly one per field you report:
  "I" = ${statusMeta[STATUS.INCLUDED].label}   — the document explicitly confirms this is part of the quoted scope/price.
  "E" = ${statusMeta[STATUS.EXCLUDED].label}   — the document explicitly says this is not included, is the homeowner's responsibility, or costs extra.
  "C" = ${statusMeta[STATUS.NEEDS_CLARIFICATION].label} — the document mentions it but the wording is ambiguous or could be read more than one way.
  "N" = ${statusMeta[STATUS.NOT_STATED].label} — the document is silent.

OUTPUT COMPACTION RULE: do NOT emit any field whose status is "N". Omitted fields are automatically treated as Not Stated. Only emit fields you can point to real words for.

For every field you DO emit, include the verbatim source snippet you based it on. If you cannot quote the document, do not emit the field.

Return ONLY a JSON object with this exact shape:
{
  "contractorName": "legal or trade name printed on the document, or empty string",
  "totalPrice": number or null,
  "proposedMethod": "the repair method as a SHORT label of at most four words — e.g. \\"Pipe bursting\\", \\"CIPP lining\\", \\"Traditional excavation\\", \\"Spot repair\\", \\"Full replacement\\" — never a full sentence. Empty string if the document does not name a method.",
  "fields": [
    { "k": "field_key", "s": "I|E|C", "v": "short extracted value", "t": "verbatim snippet from the document", "p": page_number_or_null, "c": 0.0-1.0 confidence }
  ],
  "warranties": [
    { "type": "", "length": "", "prorated": "", "transferable": "", "transferFee": "", "laborIncluded": "", "materialsIncluded": "", "exclusions": "", "sourceText": "" }
  ],
  "repairOptions": [
    { "name": "", "method": "", "price": "", "expectedServiceLife": "", "warranty": "", "advantages": "", "limitations": "", "whyRecommended": "", "fitForDocumentedCondition": "" }
  ],
  "documentNotes": "one sentence on document quality or readability problems, or empty string"
}

"warranties" must contain one entry per DISTINCT warranty the document actually describes (manufacturer product, contractor material, contractor labor, workmanship, structural, restoration, cleanout, connection). Leave sub-fields as empty strings when the document does not state them. Emit an empty array if the document describes no warranty terms.

"repairOptions" must contain one entry per repair option the document actually prices or describes. If the document offers only one option, emit exactly one entry.

ONE STATEMENT CAN ANSWER SEVERAL FIELDS. When a single written sentence covers more than one catalog field, emit ALL of them with the same source snippet. This is not inference — it is the same written words indexed under each field they answer. For example:
- "10 year parts-and-labor warranty" answers parts_and_labor_warranty AND contractor_labor_warranty AND contractor_material_warranty AND warranty_length.
- "transferable warranty" answers warranty_transferable, and if it is the contractor's own labor-and-material warranty it also answers contractor_transferable_labor_material_protection.
- "before and after camera inspection with video provided to the homeowner" answers before_camera_inspection, after_camera_inspection, before_video_provided, AND after_video_provided.
- "permits and inspections included" answers plumbing_permit, permit_fees, inspection_fees, final_inspection, AND who_obtains_permits.
- "restoration by others" answers the specific restoration fields for the surfaces named, as Clearly Excluded.
What you must NOT do is the reverse: never let one field imply another that the words do not cover. "Backfill included" answers backfill_included ONLY.

FIELD CATALOG — use these keys exactly. Any key not on this list is discarded.

${FIELD_CATALOG}`;

const SYNTHESIS_INSTRUCTIONS = `You are writing a homeowner-friendly review of already-extracted sewer estimate data for the Pro Trenchless AI Sewer Decision Center.

You are given structured extraction results only. You have NOT seen the original documents. Treat the extraction as the complete factual record.

RULES:
1. Never write "You should hire Contractor X" or any equivalent recommendation. You are comparing documents, not choosing a contractor.
2. Use framings such as "Based on the written estimates...", "The most complete documented proposal is...", "The estimate with the strongest documented warranty protection is...", "Before making a decision, clarify...".
3. Never introduce a fact that is not present in the extraction data. If something is Not Stated, say it is not stated.
4. Never favor any company by name, brand, or reputation. Judge only the documented content.
5. A low price is not an advantage and a high price is not a disadvantage. Price transparency is what you may comment on.
6. Do not exaggerate. Severity must reflect documented financial or warranty consequence.
7. Plain English, no jargon, 4-7 sentences for the summary.

Return ONLY a JSON object:
{
  "summary": "4-7 sentence homeowner-friendly comparison",
  "risks": [
    { "contractorId": "id from the input", "fieldKey": "field key from the input", "description": "why this matters to the homeowner, one or two sentences", "severity": "high|medium|low", "suggestedQuestion": "a specific question the homeowner can ask this contractor" }
  ]
}

The "risks" array must ONLY reference contractorId + fieldKey pairs present in the "candidateRisks" input. You may re-rank, reword, and re-rate severity. You may NOT invent a risk that is not in candidateRisks. Return at most 8.`;

const COMPANY_RESEARCH_INSTRUCTIONS = `Determine who owns the contractor named on a homeowner's sewer estimate. You have two kinds of evidence: (1) the identity and ownership details written in the uploaded estimate, given to you below, and (2) live web search. Use both.

Determine:
- organizationStatus:
  - "Public organization" only for a government, municipal, or other public authority.
  - "Publicly traded company" when the company — or the parent company that owns it — has shares listed on a stock exchange (for example Nasdaq or NYSE). Name the exchange and ticker in the explanation.
  - "Private organization" for a privately held business whose shares are not publicly traded. A registered business form in the legal name (Inc., LLC, Corp., Co., Ltd., LP, LLP, PLLC) is sufficient evidence of a business, unless the web shows it is publicly traded or a public authority.
  - "Unable to verify" otherwise.
- ownershipAccountability:
  - "Locally owned and operated" when the estimate, the company's own website, or an independent source describes it as locally, family, or independently owned (wording such as "family business", "family-owned", "locally owned", "local roots", "independent", or "third-generation" all count), and no matching source shows a parent company, private-equity owner, or national franchise behind it. A statement in the estimate is enough on its own even if the company cannot be found online; the explanation must then say the ownership is as stated by the contractor.
  - "Large corporation owned" when any source shows a parent company, private-equity owner, national brand, or franchise system — and always when the company itself or its parent is publicly traded, because it is then owned by stock-market shareholders rather than local owners.
  - "Ownership not verified" only when neither the document nor the web says anything about ownership, or the sources conflict.
  A license, address, or service area alone proves nothing about ownership.
  Before deciding, always check the company's own site for franchise, territory, partner, dealer, or licensing programs as well as its About page. If one source points to local ownership and another to a franchise, territory, or parent-company structure, do not pick one side: use "Ownership not verified" and describe both findings in the explanation.

Search for the company's official website (especially About/Our Story pages), state business registries, BBB and similar listings, and news of acquisitions. Matching is critical: many contractors share common names. A web result counts as this company when the name AND a location (city/state or street address) or license number match the details you were given. When no location or license is available, a name match counts only if the name is distinctive and your search shows exactly one business using it; if several different businesses share the name, none of them count. Never claim a detail matched unless that detail appears in the details you were given. If no result matches, treat the company as not found online: say so in the explanation and decide from the document evidence alone.

In "explanation" (2-4 sentences), state plainly what you found and where it came from — for example "stated on the company's About page" or "stated in the estimate; no parent company found online". If the deciding evidence is the contractor's own claim, say so.

Also report the business you matched: "matchedLegalName" is its full registered legal name as shown by the registry, website, or estimate (for example "Acme Sewer Services Southeastern PA, LLC"), and "matchedAddress" is its business address. Use "" for both when no business matched.

Return valid JSON only with exactly these keys: organizationStatus, ownershipAccountability, explanation, matchedLegalName, matchedAddress. Do not include citations or URLs in the JSON; citations are captured separately from the web-search results.`;

function parseCompanyResearchJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    // continue to fallback parsing below
  }

  const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // continue to regex fallback below
  }

  const next = {};
  const keys = ['organizationStatus', 'ownershipAccountability', 'explanation', 'matchedLegalName', 'matchedAddress'];
  for (const key of keys) {
    const match = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 'i').exec(cleaned);
    if (match) {
      next[key] = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\u003c/g, '<').replace(/\\u003e/g, '>');
    }
  }

  return Object.keys(next).length ? next : null;
}

function emptyCompanyResearch(explanation = 'Could not verify this company through web research.') {
  return {
    organizationStatus: 'Unable to verify',
    ownershipAccountability: 'Ownership not verified',
    explanation,
    sources: []
  };
}

function collectResearchSources(response) {
  const sources = new Map();
  const addSource = (source) => {
    const rawUrl = source?.url || source?.url_citation?.url;
    try {
      const parsed = new URL(rawUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) return;
      const url = parsed.href;
      if (!sources.has(url)) {
        sources.set(url, {
          url,
          title: cleanText(source.title || source.url_citation?.title || parsed.hostname, 160)
        });
      }
    } catch {
      return;
    }
  };

  for (const item of response?.output || []) {
    for (const source of item.action?.sources || []) addSource(source);
    for (const content of item.content || []) {
      for (const annotation of content.annotations || []) {
        if (annotation.type === 'url_citation') addSource(annotation);
      }
    }
  }

  return sources;
}

const ORGANIZATION_VALUES = ['Public organization', 'Publicly traded company', 'Private organization'];
const OWNERSHIP_VALUES = ['Locally owned and operated', 'Large corporation owned'];
const BUSINESS_ENTITY_RE = /\b(?:inc|incorporated|llc|l\.l\.c|corp|corporation|co|company|ltd|limited|lp|llp|pllc|pc)\.?\s*$/i;

// Identity and ownership details the estimate itself states, used as evidence alongside web search.
const DOCUMENT_IDENTITY_FIELDS = [
  ['legal_business_name', 'Legal business name'],
  ['business_address', 'Business address'],
  ['license_number', 'License / registration'],
  ['ownership_accountability', 'Ownership statement'],
  ['years_experience', 'Years of experience'],
  ['installer_matches_named_contractor', 'Installing contractor'],
  ['subcontractor_company_identified', 'Subcontractor company']
];

function documentIdentityLines(extraction = {}) {
  const fields = extraction.fields || [];
  const lines = [];
  for (const [key, label] of DOCUMENT_IDENTITY_FIELDS) {
    const field = fields.find((item) => item.key === key);
    if (!field) continue;
    const value = cleanText(field.value, 240);
    const quote = cleanText(field.sourceText, 400);
    if (value || quote) lines.push(`- ${label}: ${value || '(see quote)'}${quote && quote !== value ? ` — quote: "${quote}"` : ''}`);
  }
  if (extraction.documentNotes) lines.push(`- Document notes: ${cleanText(extraction.documentNotes, 500)}`);
  return lines;
}

/* Company research cache                                              */
/* Web search is not deterministic and each input mode (typed name,    */
/* document, both) carries different evidence. Remembering the best    */
/* answer per company keeps the same company from flip-flopping, and a */
/* weaker later run can never downgrade an earlier verified answer.    */

const RESEARCH_CACHE_FILE = path.join(config.dataDir, 'company-research-cache.json');
const RESEARCH_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Bump whenever the research rules or answer values change, so older answers are looked up again.
const RESEARCH_CACHE_VERSION = 3;
const GENERIC_NAME_RE = /^(?:contractor|company|quote|estimate|bid)\s*\d*$/i;
let researchCacheWrite = Promise.resolve();

function companyKey(name) {
  const key = String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(?:inc|incorporated|llc|l l c|corp|corporation|co|company|ltd|limited|lp|llp|pllc|pc|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // "Contractor 1" style placeholders identify nothing and must never share a cache entry.
  return key && !GENERIC_NAME_RE.test(key) ? key : '';
}

async function readResearchCache() {
  try {
    return JSON.parse(await fs.readFile(RESEARCH_CACHE_FILE, 'utf8')) || {};
  } catch {
    return {};
  }
}

const US_STATES = 'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' ');

function locationOf(address = '') {
  const text = String(address);
  const zip = /\b(\d{5})(?:-\d{4})?\b/.exec(text)?.[1] || '';
  const state = text.toUpperCase().match(/\b[A-Z]{2}\b/g)?.reverse().find((code) => US_STATES.includes(code)) || '';
  return { zip, state };
}

// Same-named companies in different places are different companies; only a missing location is compatible.
function locationsConflict(a = {}, b = {}) {
  if (a.zip && b.zip) return a.zip !== b.zip;
  if (a.state && b.state) return a.state !== b.state;
  return false;
}

function writeResearchCache(keys, research, location) {
  researchCacheWrite = researchCacheWrite
    .then(async () => {
      const cache = await readResearchCache();
      const entry = { ...research, location, cachedAt: Date.now(), version: RESEARCH_CACHE_VERSION };
      for (const key of keys) {
        const others = (Array.isArray(cache[key]) ? cache[key] : []).filter((item) => locationsConflict(item.location, location));
        cache[key] = [entry, ...others].slice(0, 10);
      }
      await fs.mkdir(path.dirname(RESEARCH_CACHE_FILE), { recursive: true });
      await fs.writeFile(RESEARCH_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
    })
    .catch((error) => console.error('Could not save company research cache:', error));
  return researchCacheWrite;
}

const isKnownOrganization = (research) => ORGANIZATION_VALUES.includes(research?.organizationStatus);
const isKnownOwnership = (research) => OWNERSHIP_VALUES.includes(research?.ownershipAccountability);

// Keep every verified answer; a fresh "unknown" never overrides an earlier finding.
function mergeResearch(cached, fresh) {
  if (!cached) return fresh;
  const ownershipFrom = isKnownOwnership(fresh) || !isKnownOwnership(cached) ? fresh : cached;
  const organizationFrom = isKnownOrganization(fresh) || !isKnownOrganization(cached) ? fresh : cached;
  return {
    organizationStatus: organizationFrom.organizationStatus,
    ownershipAccountability: ownershipFrom.ownershipAccountability,
    explanation: ownershipFrom.explanation,
    sources: ownershipFrom.sources?.length ? ownershipFrom.sources : fresh.sources || []
  };
}

async function researchCompany(openai, { contractorName, extraction }) {
  const fieldValue = (key) => cleanText(extraction.fields?.find((field) => field.key === key)?.value, 240);
  const legalName = fieldValue('legal_business_name') || cleanText(extraction.contractorName, 180);
  const homeownerName = companyKey(contractorName) ? cleanText(contractorName, 180) : '';
  const identity = legalName || homeownerName;
  if (!identity) return emptyCompanyResearch('A company name was not found on the estimate, so ownership could not be researched.');

  let location = locationOf(fieldValue('business_address'));
  const keys = new Set([companyKey(legalName), companyKey(homeownerName)].filter(Boolean));

  // Fully answered before under one of these names: reuse it so the company always shows the same result.
  const known = await bestCachedResearch(keys, location);
  if (known && isKnownOwnership(known.research) && isKnownOrganization(known.research)) {
    await writeResearchCache(keys, known.research, mergeLocation(location, known.location));
    return known.research;
  }

  const fresh = await runCompanyResearch(openai, { identity, legalName, homeownerName, extraction });
  if (fresh.failed) return publicResearch(mergeResearch(known?.research, fresh));

  // Name-only, document-only, and combined inputs all resolve to the same registered legal name,
  // so the result is filed and looked up under that name too.
  location = mergeLocation(location, locationOf(fresh.matchedAddress));
  const canonicalKey = companyKey(fresh.matchedLegalName);
  if (canonicalKey) keys.add(canonicalKey);
  const canonical = canonicalKey ? await bestCachedResearch(new Set([canonicalKey]), location) : null;

  const research = canonical && isKnownOwnership(canonical.research) && isKnownOrganization(canonical.research)
    ? canonical.research
    : mergeResearch(canonical?.research || known?.research, publicResearch(fresh));
  await writeResearchCache(keys, research, mergeLocation(location, canonical?.location || known?.location));
  return research;
}

function publicResearch({ organizationStatus, ownershipAccountability, explanation, sources }) {
  return { organizationStatus, ownershipAccountability, explanation, sources: sources || [] };
}

function mergeLocation(a = {}, b = {}) {
  return { zip: a.zip || b?.zip || '', state: a.state || b?.state || '' };
}

async function bestCachedResearch(keys, location) {
  const cache = await readResearchCache();
  const entry = [...keys]
    .flatMap((key) => (Array.isArray(cache[key]) ? cache[key] : []))
    .filter((item) => item.version === RESEARCH_CACHE_VERSION && Date.now() - item.cachedAt < RESEARCH_CACHE_TTL_MS && !locationsConflict(item.location, location))
    .sort((a, b) => (isKnownOwnership(b) - isKnownOwnership(a)) || (isKnownOrganization(b) - isKnownOrganization(a)))[0];
  return entry ? { research: publicResearch(entry), location: entry.location } : null;
}

async function runCompanyResearch(openai, { identity, legalName, homeownerName, extraction }) {
  // A registered business form in either name is evidence of a private business on its own.
  const entityName = [legalName, homeownerName].find((name) => BUSINESS_ENTITY_RE.test(name)) || '';
  const documentShowsPrivateEntity = Boolean(entityName);
  const documentLines = documentIdentityLines(extraction);

  try {
    const response = await openai.responses.create({
      model: config.openaiModel,
      instructions: COMPANY_RESEARCH_INSTRUCTIONS,
      input: [
        `Company to research: ${identity}`,
        homeownerName && homeownerName !== identity ? `The homeowner entered this company name: ${homeownerName}` : '',
        documentLines.length
          ? `Identity details written in the uploaded estimate:\n${documentLines.join('\n')}`
          : 'The uploaded estimate states no identity details beyond the company name.',
        'Search the web for this company, then return JSON only with exactly these keys: organizationStatus, ownershipAccountability, explanation, matchedLegalName, matchedAddress.'
      ].filter(Boolean).join('\n\n'),
      tools: [{ type: 'web_search', search_context_size: 'medium' }],
      tool_choice: 'required',
      include: ['web_search_call.action.sources'],
      // Reasoning models spend part of this budget thinking; too small a limit returns no text at all.
      max_output_tokens: 5000
    });

    const rawText = extractOutputText(response) || response.output_text || '';
    const json = parseCompanyResearchJson(rawText) || parseJsonFromText(rawText);
    const sources = [...collectResearchSources(response).values()].slice(0, 5);

    if (!json) {
      console.warn('Contractor web research returned no usable JSON:', { identity, status: response.status, incomplete: response.incomplete_details });
    }

    let organizationStatus = ORGANIZATION_VALUES.includes(json?.organizationStatus) ? json.organizationStatus : 'Unable to verify';
    let ownershipAccountability = OWNERSHIP_VALUES.includes(json?.ownershipAccountability) ? json.ownershipAccountability : 'Ownership not verified';
    let explanation = cleanText(json?.explanation, 700);

    // A publicly traded company is owned by stock-market shareholders, never by local owners.
    if (organizationStatus === 'Publicly traded company' && ownershipAccountability !== 'Large corporation owned') {
      ownershipAccountability = 'Large corporation owned';
      explanation = `${explanation ? `${explanation} ` : ''}As a publicly traded company, it is owned by its stock-market shareholders and is classed as large corporation owned.`;
    }

    if (organizationStatus === 'Unable to verify' && documentShowsPrivateEntity) {
      organizationStatus = 'Private organization';
      explanation = `${explanation ? `${explanation} ` : ''}The company name "${entityName}" is a registered business entity, which identifies a privately operated business.`;
    }

    return {
      organizationStatus,
      ownershipAccountability,
      explanation: explanation || 'Web search did not find enough information about this company to confirm its ownership.',
      sources,
      matchedLegalName: cleanText(json?.matchedLegalName, 180),
      matchedAddress: cleanText(json?.matchedAddress, 240),
      // Unparseable replies are not remembered, so the next run gets a fresh attempt.
      failed: !json
    };
  } catch (error) {
    console.error('Contractor web research failed:', error);
    const fallback = { ...emptyCompanyResearch('Web research was unavailable; ownership was not verified.'), failed: true };
    if (documentShowsPrivateEntity) {
      fallback.organizationStatus = 'Private organization';
      fallback.explanation += ` The company name "${entityName}" is a registered business entity.`;
    }
    return fallback;
  }
}

/* ------------------------------------------------------------------ */
/* Extraction                                                          */
/* ------------------------------------------------------------------ */

function projectContextText(projectBasics = {}) {
  const entries = Object.entries(projectBasics)
    .filter(([, value]) => value !== '' && value !== null && value !== undefined)
    .map(([key, value]) => `- ${key}: ${value}`);
  if (!entries.length) return 'The homeowner did not provide project basics.';
  return `Homeowner-provided project context (background only — never treat this as contractor scope):\n${entries.join('\n')}`;
}

function emptyExtraction(reason) {
  return {
    contractorName: '',
    totalPrice: null,
    proposedMethod: '',
    fields: [],
    warranties: [],
    repairOptions: [],
    documentNotes: reason || ''
  };
}

function normalizeExtractionPayload(json) {
  if (!json || typeof json !== 'object') return null;

  const rawFields = Array.isArray(json.fields) ? json.fields : [];
  const fields = [];

  for (const raw of rawFields.slice(0, 400)) {
    const key = cleanText(raw?.k || raw?.key, 80);
    if (!key || !fieldByKey[key]) continue;

    const code = cleanText(raw?.s || raw?.status, 40);
    const status = STATUS_CODES[code.toUpperCase()] || (Object.values(STATUS).includes(code) ? code : null);
    if (!status || status === STATUS.NOT_STATED) continue;

    fields.push({
      key,
      status,
      value: cleanText(raw?.v ?? raw?.value, 400),
      sourceText: cleanText(raw?.t ?? raw?.sourceText, 700),
      sourcePage: Number.isFinite(Number(raw?.p ?? raw?.sourcePage)) ? Number(raw?.p ?? raw?.sourcePage) : null,
      confidence: Number.isFinite(Number(raw?.c ?? raw?.confidence)) ? Number(raw?.c ?? raw?.confidence) : null
    });
  }

  const totalPriceRaw = json.totalPrice;
  const totalPrice = Number.isFinite(Number(totalPriceRaw)) && Number(totalPriceRaw) > 0 ? Number(totalPriceRaw) : null;

  return {
    contractorName: cleanText(json.contractorName, 160),
    totalPrice,
    proposedMethod: cleanText(json.proposedMethod, 160),
    fields,
    warranties: Array.isArray(json.warranties) ? json.warranties.slice(0, 12) : [],
    repairOptions: Array.isArray(json.repairOptions) ? json.repairOptions.slice(0, 8) : [],
    documentNotes: cleanText(json.documentNotes, 900)
  };
}

async function resolveUploads(uploadedFileIds = []) {
  const files = [];
  for (const id of uploadedFileIds.slice(0, 4)) {
    const upload = await findUpload(cleanText(id, 100));
    if (upload) files.push(upload);
  }
  return files;
}

/**
 * Extract one contractor estimate. Never throws — returns a degraded result
 * with `mode` describing what happened so the UI can be honest about it.
 */
export async function extractEstimate({ contractorName, uploadedFileIds = [], pastedText = '', totalPrice = null, projectBasics = {} }) {
  const openai = getClient();
  const uploadedFiles = await resolveUploads(uploadedFileIds);
  const trimmedPaste = cleanText(pastedText, 20000);

  if (!uploadedFiles.length && !trimmedPaste) {
    return {
      mode: 'no-document',
      extraction: emptyExtraction('No estimate document or estimate text was provided for this contractor.'),
      fileName: ''
    };
  }

  const fileName = uploadedFiles.map((file) => file.originalName).filter(Boolean).join(', ');

  if (!openai) {
    return {
      mode: 'fallback',
      extraction: emptyExtraction(
        'AI extraction is not configured on this server, so no fields could be read from this document. Every item is shown as Not Stated rather than guessed.'
      ),
      research: emptyCompanyResearch('AI web research is not configured on this server.'),
      fileName
    };
  }

  const textInput = [
    `Contractor name supplied by the homeowner: ${cleanText(contractorName, 160) || 'not provided'}`,
    totalPrice ? `Estimate total supplied by the homeowner: ${totalPrice}` : 'The homeowner did not supply an estimate total.',
    projectContextText(projectBasics),
    trimmedPaste ? `\nEstimate text pasted by the homeowner:\n"""\n${trimmedPaste}\n"""` : '',
    '\nExtract the attached sewer repair estimate document(s) using the field catalog and the rules. Return JSON only.'
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const { content } = await buildMultimodalContent({ textInput, uploadedFiles });

    const response = await openai.responses.create({
      model: config.openaiModel,
      instructions: EXTRACTION_INSTRUCTIONS,
      input: [{ role: 'user', content }],
      temperature: 0,
      max_output_tokens: 12000,
      text: { format: { type: 'json_object' } }
    });

    const raw = extractOutputText(response);
    const json = parseJsonFromText(raw);
    const extraction = normalizeExtractionPayload(json);
    const research = await researchCompany(openai, { contractorName, extraction: extraction || {} });

    if (!extraction) {
      return {
        mode: 'parse-error',
        extraction: emptyExtraction("We couldn't read this estimate reliably. Try uploading a clearer PDF or image."),
        research,
        fileName
      };
    }

    return { mode: 'openai', extraction, research, fileName, responseId: response.id || null };
  } catch (error) {
    console.error('Estimate extraction failed:', error);
    return {
      mode: 'error',
      extraction: emptyExtraction(
        "We couldn't read this estimate. Try uploading a clearer PDF or image, or paste the estimate text instead."
      ),
      // Skip web research here: the failure is usually an API/network problem, so a second call would likely fail too.
      research: emptyCompanyResearch('Web research was skipped because the estimate could not be read.'),
      fileName
    };
  }
}

/* ------------------------------------------------------------------ */
/* Synthesis                                                           */
/* ------------------------------------------------------------------ */

/**
 * Produce the homeowner-friendly summary and re-rank the candidate risks.
 * Candidate risks are computed deterministically by the caller — the model may
 * only reword and re-rank them, never add new ones.
 */
export async function synthesizeComparison({ contractors = [], candidateRisks = [], projectBasics = {} }) {
  const openai = getClient();
  if (!openai || !contractors.length) {
    return { mode: openai ? 'skipped' : 'fallback', summary: '', risks: [] };
  }

  const payload = {
    projectBasics,
    contractors: contractors.map((contractor) => ({
      id: contractor.id,
      contractorName: contractor.contractorName,
      totalPrice: contractor.totalPrice,
      proposedMethod: contractor.proposedMethod,
      overallScore: contractor.overallScore,
      categoryScores: contractor.groupScores.map((group) => ({ id: group.id, label: group.label, score: group.score })),
      clearlyIncluded: contractor.statusCounts[STATUS.INCLUDED],
      clearlyExcluded: contractor.statusCounts[STATUS.EXCLUDED],
      notStated: contractor.statusCounts[STATUS.NOT_STATED],
      needsClarification: contractor.statusCounts[STATUS.NEEDS_CLARIFICATION],
      repairOptionCount: contractor.repairOptions.length,
      warrantyTypesDocumented: contractor.warranties.map((warranty) => warranty.type)
    })),
    candidateRisks: candidateRisks.map((risk) => ({
      contractorId: risk.contractorId,
      contractorName: risk.contractorName,
      fieldKey: risk.fieldKey,
      title: risk.title,
      status: risk.status,
      severity: risk.severity,
      category: risk.category
    }))
  };

  try {
    const response = await openai.responses.create({
      model: config.openaiModel,
      instructions: SYNTHESIS_INSTRUCTIONS,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              // The Responses API rejects text.format json_object unless the
              // input itself mentions JSON, so the framing line is required.
              text: `Here is the extracted comparison data as JSON. Review it and reply with JSON only.\n\n${JSON.stringify(payload, null, 2).slice(0, 60000)}`
            }
          ]
        }
      ],
      temperature: 0.2,
      max_output_tokens: 2500,
      text: { format: { type: 'json_object' } }
    });

    const json = parseJsonFromText(extractOutputText(response));
    if (!json || typeof json !== 'object') return { mode: 'parse-error', summary: '', risks: [] };

    return {
      mode: 'openai',
      summary: cleanText(json.summary, 2000),
      risks: Array.isArray(json.risks) ? json.risks.slice(0, 8) : []
    };
  } catch (error) {
    console.error('Comparison synthesis failed:', error);
    return { mode: 'error', summary: '', risks: [] };
  }
}
