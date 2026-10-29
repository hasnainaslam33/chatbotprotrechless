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
  - "Publicly traded company" only when an official exchange, company investor-relations page, or regulatory filing establishes that the company or its parent is listed. Include ticker and exchange in the explanation.
  - "Private organization" when a primary source explicitly establishes private ownership/holding status. A LinkedIn company page whose Type field says "Privately Held" may support this status as a self-reported secondary classification; explain that limitation. Do not treat that label as evidence of who owns shares or who holds a majority. A state entity registration, LLC/Inc. suffix, absence of a stock ticker in search results, or a BBB listing does NOT establish private ownership.
  - "Unable to verify" otherwise.
- ownershipAccountability:
  - "Locally owned and operated" only when a matching source explicitly states local, family, or independent ownership and no reliable evidence contradicts it. If the only evidence is the contractor's own marketing claim, explain that it is self-reported.
  - "Large corporation owned" only when reliable, company-specific evidence establishes control by a parent, private-equity firm, corporate group, or franchise system. A publicly traded status alone does not establish that the company is "large corporation owned" under this label.
  - "PE-backed platform" when reliable, company-specific evidence shows the contractor was acquired by or belongs to a platform that is majority-owned or controlled by a private-equity firm, even if it keeps its local trade name. Prefer this over "Large corporation owned" when the sponsor is PE.
  - "Franchise" only when reliable evidence shows the contractor operates as a franchisee or under a franchise/licensing system of a national brand.
  - "Publicly traded (shareholder-owned)" when an official source establishes that the contractor itself is publicly traded. This does not mean a named investor or parent company owns a majority.
  - "Ownership not verified" whenever the evidence is absent, ambiguous, mismatched, or conflicting. A privately-held classification does not establish a named owner, local control, or absence of PE investment.
  A license, address, or service area alone proves nothing about ownership.
  A dealer, partner, territory, or licensing program is not by itself proof that a company is a franchise or that another company owns it.

Search primary sources first: official company pages/disclosures, filings, acquisition announcements, and parent/portfolio pages. Use state registries to establish legal registration only, and directories/BBB as secondary identity evidence only. A matching LinkedIn company page may support a clearly attributed, self-reported "Privately Held" organization status, but not a specific owner, majority ownership, local control, or absence of PE investment. Matching is critical: a web result counts as this company when name AND location (city/state/address) or a license number match supplied details. Without location or license, match only a distinctive name with no plausible namesake. Never use unrelated companies or sources to fill a field. If identity is ambiguous, say so and return unable_to_verify for ownership details.

A founder, executive, spokesperson, or family-trade-history statement does not by itself establish current equity ownership or majority control. Likewise, absence from an industry rollup or PE database is not proof that a company has never had PE ownership.

Always read the company's own About, history, and homepage content before concluding. If those pages describe it as a family business, family-owned, locally owned, or independent, and no source shows a parent, PE owner, or franchise, report ownershipAccountability "Locally owned and operated" and say in the explanation that this is self-reported by the company. For currentMajorityOwner: if the company's own pages or a press release naming the company call a specific person its "owner", "founder", or "president" (for example "Jane Doe, Owner of X"), use status "unverified" with value "Jane Doe (named as owner/founder by the company; equity not independently confirmed)", the exact quote, and that page URL. If only family or local ownership is described without a name, use the self-reported description (for example "Family-owned (self-reported by the company)"). Never invent a name that no source states, and never claim registered equity ownership from a title alone.

For "acquirerPlatform" and "priorPeOwner" only: if you searched the company and its brand with "acquired by", "private equity", "portfolio company", and "majority stake", checked the company's own site, and found nothing about an acquirer or PE owner for this specific company, use status "none_found" with value "None found in public sources" and put a one-sentence summary of what you searched in "evidence". This is not proof that none exists. Use "none_found" only after real searches and only when identity is clearly matched; otherwise use "unable_to_verify".

Also determine four ownership details independently:
- "localBrand": the public-facing operating/trade brand. An official company website using the name as its brand is suitable evidence; prefer its About or homepage over a terms/footer page or directory profile heading. Do not substitute the registered legal entity name or a website domain. Add a former name only if an official company page explicitly states the old name and the rename, e.g. "Adam Mechanical officially became Adam Home Services". For a renamed company, quote that complete sentence as evidence and cite the official rename/About page, not a general services listing.
- "acquirerPlatform": name an acquirer or platform only when a primary source or reputable direct announcement explicitly says this specific company/brand was acquired or joined that platform. A directory listing, shared branding, or common address is not evidence.
- "currentMajorityOwner": name an owner only when a current primary source or filing directly establishes majority equity ownership or control. Do not name a parent, investor, lender, adviser, or shareholder as majority owner unless the source establishes majority ownership/control. Public-company status does not identify a majority shareholder.
- "priorPeOwner": name a former private-equity owner only when a reliable source directly establishes its past ownership of this specific company AND its exit/sale of that stake. A source saying it invested or partnered is not enough to call it a prior owner. Do not mistake an adviser, lender, or minority investor for an owner.

For each detail return an object with exactly these keys: "value", "status", "evidence", "eventDate", "sourceUrls". "status" must be "verified", "unverified", "none_found" (acquirerPlatform and priorPeOwner only), or "unable_to_verify". For verified claims, evidence must be a short, exact quotation from the cited source that directly supports the claim; do not paraphrase a source as a quote. If the source only suggests a possibility or sources conflict, use "unverified", explain the limitation, and cite relevant URLs. When there is no direct evidence, use "unable_to_verify", empty value, empty evidence, empty eventDate, and an empty sourceUrls array. Never manufacture a date, quote, source, legal entity, or relationship. sourceUrls must contain only direct URLs returned by web search, not guessed URLs. eventDate should be the relevant acquisition/name-change/ownership date only if explicitly stated; otherwise use an empty string.

Also return "organizationEvidence" and "ownershipEvidence" objects, each with exactly "evidence" and "sourceUrls". The evidence must be a short, exact source quotation directly supporting the selected classification, and sourceUrls must be URLs returned by web search. If there is no direct evidence, use empty strings and an empty array. A legal registry entry establishes registration, not private ownership. Do not call a company private solely because it is not found in exchange searches.

In "explanation" (2-4 sentences), state plainly what you found and where it came from. Report "matchedLegalName" and "matchedAddress" only when the entity is a credible match; otherwise use empty strings.

Return valid JSON only with exactly these keys: organizationStatus, organizationEvidence, ownershipAccountability, ownershipEvidence, explanation, matchedLegalName, matchedAddress, ownershipDetails. ownershipDetails must contain exactly localBrand, acquirerPlatform, currentMajorityOwner, priorPeOwner with the object shape above. Do not treat an officer, manager, registered agent, shared address, similar name, or LLC/Inc. suffix as evidence of equity ownership. Citations are also captured separately from web-search results.`;

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

const OWNERSHIP_DETAIL_KEYS = ['localBrand', 'acquirerPlatform', 'currentMajorityOwner', 'priorPeOwner'];

function unknownOwnershipClaim() {
  return { value: 'Unable to verify', status: 'unable_to_verify', evidence: '', eventDate: '', sources: [] };
}

function emptyOwnershipDetails() {
  return Object.fromEntries(OWNERSHIP_DETAIL_KEYS.map((key) => [key, unknownOwnershipClaim()]));
}

function emptyCompanyResearch(explanation = 'Could not verify this company through web research.') {
  return {
    organizationStatus: 'Unable to verify',
    ownershipAccountability: 'Ownership not verified',
    explanation,
    sources: [],
    organizationEvidence: { evidence: '', sources: [] },
    ownershipEvidence: { evidence: '', sources: [] },
    ownershipDetails: emptyOwnershipDetails(),
    retrievedAt: ''
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
const OWNERSHIP_VALUES = ['Locally owned and operated', 'Large corporation owned', 'PE-backed platform', 'Franchise', 'Publicly traded (shareholder-owned)'];
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
const RESEARCH_CACHE_VERSION = 16;
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
    sources: ownershipFrom.sources?.length ? ownershipFrom.sources : fresh.sources || [],
    organizationEvidence: organizationFrom.organizationEvidence || fresh.organizationEvidence || { evidence: '', sources: [] },
    ownershipEvidence: ownershipFrom.ownershipEvidence || fresh.ownershipEvidence || { evidence: '', sources: [] },
    ownershipDetails: Object.fromEntries(OWNERSHIP_DETAIL_KEYS.map((key) => {
      const oldClaim = cached.ownershipDetails?.[key];
      const newClaim = fresh.ownershipDetails?.[key];
      return [key, oldClaim?.status === 'verified' && newClaim?.status !== 'verified' ? oldClaim : newClaim || unknownOwnershipClaim()];
    })),
    retrievedAt: fresh.retrievedAt || cached.retrievedAt || ''
  };
}

async function researchCompany(openai, { contractorName, extraction }) {
  const fieldValue = (key) => cleanText(extraction.fields?.find((field) => field.key === key)?.value, 240);
  const legalName = fieldValue('legal_business_name') || cleanText(extraction.contractorName, 180);
  const homeownerName = companyKey(contractorName) ? cleanText(contractorName, 180) : '';
  const identity = homeownerName || legalName;
  if (!identity) return emptyCompanyResearch('A company name was not found on the estimate, so ownership could not be researched.');

  let location = locationOf(fieldValue('business_address'));
  const keys = new Set([companyKey(legalName), companyKey(homeownerName)].filter(Boolean));

  // A completed search, including a result with insufficient evidence, is reusable until its cache expires.
  const known = await bestCachedResearch(keys, location);
  if (known?.research.retrievedAt) {
    await writeResearchCache(keys, known.research, mergeLocation(location, known.location));
    return known.research;
  }

  const fresh = await runCompanyResearch(openai, { identity, legalName, homeownerName, extraction });
  if (fresh.failed) return publicResearch(mergeResearch(known?.research, fresh));

  const acquirer = fresh.ownershipDetails?.acquirerPlatform;
  if (['verified', 'unverified'].includes(acquirer?.status) && acquirer.value) {
    const platformResearch = await researchPlatformOwnership(openai, acquirer.value);
    for (const key of ['currentMajorityOwner', 'priorPeOwner']) {
      const platformClaim = platformResearch[key];
      if (platformClaim.status !== 'unable_to_verify') {
        fresh.ownershipDetails[key] = platformClaim;
      }
    }
  }

  // Verified acquisition details outrank a headline left at "not verified" (they come from the same research).
  if (!isKnownOwnership(fresh) && acquirer?.status === 'verified' && acquirer.sources?.length) {
    const owner = fresh.ownershipDetails.currentMajorityOwner;
    const prior = fresh.ownershipDetails.priorPeOwner;
    const peLike = prior?.status === 'verified'
      || (owner?.status === 'verified' && /\b(private equity|capital|alternatives|equity|partners)\b/i.test(`${owner.value} ${owner.evidence}`));
    fresh.ownershipAccountability = peLike ? 'PE-backed platform' : 'Large corporation owned';
    fresh.ownershipEvidence = { evidence: acquirer.evidence, sources: acquirer.sources };
  }

  // A named owner plus searched-and-empty acquirer/PE results supports a self-reported "locally owned" label.
  const namedOwner = fresh.ownershipDetails?.currentMajorityOwner;
  if (
    !isKnownOwnership(fresh)
    && namedOwner?.status === 'unverified' && namedOwner.sources?.length && namedOwner.evidence
    && fresh.ownershipDetails.acquirerPlatform?.status === 'none_found'
    && fresh.ownershipDetails.priorPeOwner?.status === 'none_found'
  ) {
    fresh.ownershipAccountability = 'Locally owned and operated';
    fresh.ownershipEvidence = { evidence: namedOwner.evidence, sources: namedOwner.sources };
    fresh.explanation = `${fresh.explanation || ''} Self-reported: a named owner was found in company-published material and no acquirer or private-equity owner turned up in public sources; this does not prove who holds the equity.`.trim();
  }

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

async function researchPlatformOwnership(openai, platformName) {
  const empty = {
    currentMajorityOwner: unknownOwnershipClaim(),
    priorPeOwner: unknownOwnershipClaim()
  };

  try {
    const response = await openai.responses.create({
      model: config.openaiModel,
      instructions: `Research the ownership history of this home-services platform, using live web search. Prioritize official company, investor, and transaction-announcement sources.

Return JSON with exactly currentMajorityOwner and priorPeOwner. Each value is an object with exactly value, status, evidence, eventDate, sourceUrls.

currentMajorityOwner is the current controlling/majority owner only if reliable evidence confirms the transaction actually closed and that entity currently owns or controls the platform. If the best evidence only says an investor "will acquire", "agreed to acquire", or that closing is subject to approvals, do NOT report that investor as a confirmed current owner. Instead use status "unverified" and explain in value/evidence that a majority acquisition was announced but the source does not confirm closing.

priorPeOwner is a prior private-equity owner only if reliable evidence directly establishes that the firm owned the platform and that its sale/exit actually closed. An agreement to sell, an announced transaction, or a pending regulatory approval does not establish a completed exit; do not label that firm a prior owner unless another reliable source confirms closing. A lender, advisor, or minority investor alone is not an owner.

For verified findings, evidence must be a short exact quotation directly supporting the claim. Use sourceUrls only from direct web-search citations. Include a date only when the source states it. If evidence is missing, use status "unable_to_verify", empty value/evidence/eventDate, and [] sourceUrls. Do not invent information, dates, or URLs.`,
      input: `Research the ownership chain for this identified parent/acquirer platform: ${cleanText(platformName, 180)}.

Find the platform's current majority owner and its immediately prior private-equity owner. Search the platform's own releases and the investor/acquirer/seller's official transaction announcements. Return JSON only.`,
      tools: [{ type: 'web_search', search_context_size: 'high' }],
      tool_choice: 'required',
      include: ['web_search_call.action.sources'],
      max_output_tokens: 3500
    });

    const json = parseJsonFromText(extractOutputText(response) || response.output_text || '');
    if (!json) {
      console.warn('Platform ownership research returned no usable JSON:', { platformName, status: response.status });
      return empty;
    }

    const sources = [...collectResearchSources(response).values()];
    return {
      currentMajorityOwner: normalizeOwnershipClaim(json.currentMajorityOwner, sources, 'currentMajorityOwner'),
      priorPeOwner: normalizeOwnershipClaim(json.priorPeOwner, sources, 'priorPeOwner')
    };
  } catch (error) {
    console.error('Platform ownership research failed:', { platformName, error });
    return empty;
  }
}

function normalizeOwnershipClaim(claim, sources, key = '') {
  const sourceMap = new Map(sources.map((source) => [source.url, source]));
  const sourceUrls = Array.isArray(claim?.sourceUrls)
    ? claim.sourceUrls
    : (Array.isArray(claim?.sources) ? claim.sources.map((source) => source?.url) : []);
  const linkedSources = [...new Set(sourceUrls)].flatMap((rawUrl) => {
    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return [];
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) return [];
    const canonical = `${parsed.hostname.replace(/^www\./, '').toLowerCase()}${parsed.pathname.replace(/\/+$/, '')}`;
    const exactPathMatches = [...sourceMap.entries()].filter(([url]) => {
      try {
        const sourceUrl = new URL(url);
        return `${sourceUrl.hostname.replace(/^www\./, '').toLowerCase()}${sourceUrl.pathname.replace(/\/+$/, '')}` === canonical;
      } catch {
        return false;
      }
    });
    if (exactPathMatches.length) return exactPathMatches.map(([, source]) => source);
    const sameHost = sources.filter((source) => {
      try {
        return new URL(source.url).hostname.replace(/^www\./, '').toLowerCase() === parsed.hostname.replace(/^www\./, '').toLowerCase();
      } catch {
        return false;
      }
    });
    return sameHost.length === 1 ? sameHost : [];
  });
  const status = ['verified', 'unverified', 'none_found', 'unable_to_verify'].includes(claim?.status) ? claim.status : 'unable_to_verify';
  const evidence = cleanText(claim?.evidence, 500);
  const value = cleanText(claim?.value, 240);

  // A searched-and-empty result is only meaningful for "is there an acquirer / prior PE owner"; it is not proof.
  if (status === 'none_found' && ['acquirerPlatform', 'priorPeOwner'].includes(key)) {
    return {
      value: 'None found in public sources',
      status,
      evidence: evidence || 'Searches found no acquirer or private-equity owner. This is not proof that none exists.',
      eventDate: '',
      sources: []
    };
  }

  if (status === 'unable_to_verify' || !value) {
    return unknownOwnershipClaim();
  }

  // A finding without a quote or a matching search citation is still shown, but never as verified.
  const finalStatus = status === 'verified' && (!evidence || !linkedSources.length) ? 'unverified' : status;

  let normalizedValue = value;
  let eventDate = cleanText(claim?.eventDate, 80);
  if (key === 'localBrand') {
    const became = /\b(?:in\s+(\d{4})[, ]+)?(.+?)\s+(?:officially\s+)?became\s+(.+?)(?:[.!]|$)/i.exec(evidence);
    const knownAs = /\b(?:you might know us as|formerly known as|formerly called|previously known as)\s+["“]?([^.”",]+)["”]?/i.exec(evidence);
    const formerName = cleanText(became?.[2] || knownAs?.[1], 160);
    if (formerName && !normalizedValue.toLowerCase().includes('formerly')) {
      normalizedValue = `${normalizedValue} (formerly ${formerName})`;
    }
    if (!eventDate && became?.[1]) eventDate = became[1];
  }

  return {
    value: finalStatus === 'unverified' && !/^unverified:/i.test(normalizedValue) ? `Unverified: ${normalizedValue}` : normalizedValue,
    status: finalStatus,
    evidence,
    eventDate,
    sources: linkedSources
  };
}

function normalizeOwnershipDetails(details, sources) {
  return Object.fromEntries(OWNERSHIP_DETAIL_KEYS.map((key) => [key, normalizeOwnershipClaim(details?.[key], sources, key)]));
}

function normalizeClassificationEvidence(evidence, sources) {
  const linkedSources = normalizeOwnershipClaim({
    value: evidence?.evidence,
    status: 'verified',
    evidence: evidence?.evidence,
    sourceUrls: evidence?.sourceUrls || evidence?.sources?.map((source) => source?.url)
  }, sources).sources;
  const quote = cleanText(evidence?.evidence, 500);
  if (!quote || !linkedSources.length) return { evidence: '', sources: [] };
  const selfReportedLinkedInType = /\bprivately held\b/i.test(quote) && linkedSources.some((source) => {
    try {
      const url = new URL(source.url);
      return (url.hostname.toLowerCase() === 'linkedin.com' || url.hostname.toLowerCase().endsWith('.linkedin.com'))
        && /\/company\//i.test(url.pathname);
    } catch {
      return false;
    }
  });
  return {
    evidence: quote,
    sources: linkedSources,
    qualification: selfReportedLinkedInType ? 'Self-reported company profile; this does not establish a majority owner.' : ''
  };
}

function hasClassificationSupport(status, evidence, sources = []) {
  const text = String(evidence || '').toLowerCase();
  if (status === 'Publicly traded company') return /\b(nasdaq|nyse|new york stock exchange|stock exchange|publicly traded|traded on)\b/.test(text);
  if (status === 'Private organization') {
    return /\b(privately held|privately owned|private company|private business)\b/.test(text) && sources.length > 0;
  }
  if (status === 'Public organization') return /\b(municipal|government|public authority|public agency|publicly owned)\b/.test(text);
  if (status === 'Locally owned and operated') return /\b(locally owned|family[- ]owned|independently owned|family business)\b/.test(text);
  if (status === 'Large corporation owned') return /\b(owned by|acquired by|subsidiary of|portfolio company|private equity|franchisee of|parent company)\b/.test(text);
  if (status === 'PE-backed platform') return /\b(private equity|majority stake|majority investment|portfolio company|backed by|capital partners|alternatives|equity partners|acquired by)\b/.test(text);
  if (status === 'Franchise') return /\bfranchis\w*\b/.test(text);
  if (status === 'Publicly traded (shareholder-owned)') return /\b(nasdaq|nyse|new york stock exchange|stock exchange|publicly traded|traded on)\b/.test(text);
  return false;
}

function publicResearch(research = {}) {
  const sources = Array.isArray(research.sources) ? research.sources : [];
  const ownershipSources = [
    ...OWNERSHIP_DETAIL_KEYS.flatMap((key) => research.ownershipDetails?.[key]?.sources || []),
    ...(research.organizationEvidence?.sources || []),
    ...(research.ownershipEvidence?.sources || [])
  ];
  const sourcePool = [...new Map([...sources, ...ownershipSources].map((source) => [source.url, source])).values()];
  return {
    organizationStatus: research.organizationStatus || 'Unable to verify',
    ownershipAccountability: research.ownershipAccountability || 'Ownership not verified',
    explanation: research.explanation || 'Web search did not find enough information about this company to confirm its ownership.',
    sources,
    matchedLegalName: research.matchedLegalName || '',
    matchedAddress: research.matchedAddress || '',
    organizationEvidence: normalizeClassificationEvidence(research.organizationEvidence, sourcePool),
    ownershipEvidence: normalizeClassificationEvidence(research.ownershipEvidence, sourcePool),
    ownershipDetails: normalizeOwnershipDetails(research.ownershipDetails, sourcePool),
    retrievedAt: research.retrievedAt || ''
  };
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
        `Search the web for this exact company. Run separate searches for the company name with "owner", "founder", "president", and "about us", and read its own About page and its press releases (press-release sites often name the owner or founder in a quote or byline). Search for its LinkedIn company page explicitly (for example "site:linkedin.com/company" plus the company name and its city or state, and also the name alone), open it, and read the About section's Type field, then check that the page's headquarters or website matches the company. Check a matching LinkedIn company page's Type field for self-reported company status, while keeping that distinct from evidence of specific equity owners. For brand identity/history, search the company name with "formerly", "previously known as", and "officially became"; prefer its official About/rename page. For acquisitions, search the company name with "acquired by" and the named parent/platform. For sponsor ownership, also search the identified platform with "majority stake", "private equity", "sale", "seller", and "transaction closed". Do not stop at the local brand's acquirer; follow its ownership chain one level upstream. A founder or spokesperson citation does not establish majority ownership, and not appearing in a PE rollup is not proof of no PE history. Return JSON only with exactly these keys: organizationStatus, organizationEvidence, ownershipAccountability, ownershipEvidence, explanation, matchedLegalName, matchedAddress, ownershipDetails.`
      ].filter(Boolean).join('\n\n'),
      tools: [{ type: 'web_search', search_context_size: 'high' }],
      tool_choice: 'required',
      include: ['web_search_call.action.sources'],
      // Reasoning models spend part of this budget thinking; too small a limit returns no text at all.
      max_output_tokens: 5000
    });

    const rawText = extractOutputText(response) || response.output_text || '';
    const json = parseCompanyResearchJson(rawText) || parseJsonFromText(rawText);
    const sources = [...collectResearchSources(response).values()];

    if (!json) {
      console.warn('Contractor web research returned no usable JSON:', { identity, status: response.status, incomplete: response.incomplete_details });
    }

    let organizationEvidence = normalizeClassificationEvidence(json?.organizationEvidence, sources);
    let ownershipEvidence = normalizeClassificationEvidence(json?.ownershipEvidence, sources);
    let organizationStatus = ORGANIZATION_VALUES.includes(json?.organizationStatus)
      && organizationEvidence.sources.length
      && hasClassificationSupport(json.organizationStatus, organizationEvidence.evidence, organizationEvidence.sources)
      ? json.organizationStatus
      : 'Unable to verify';
    let ownershipAccountability = OWNERSHIP_VALUES.includes(json?.ownershipAccountability)
      && ownershipEvidence.sources.length
      && hasClassificationSupport(json.ownershipAccountability, ownershipEvidence.evidence, ownershipEvidence.sources)
      ? json.ownershipAccountability
      : 'Ownership not verified';
    if (organizationStatus === 'Publicly traded company' && hasClassificationSupport(organizationStatus, organizationEvidence.evidence, organizationEvidence.sources)) {
      ownershipAccountability = 'Publicly traded (shareholder-owned)';
      ownershipEvidence = organizationEvidence;
    }
    let explanation = cleanText(json?.explanation, 700);
    if (organizationStatus === 'Unable to verify') organizationEvidence = { evidence: '', sources: [] };
    if (ownershipAccountability === 'Ownership not verified') ownershipEvidence = { evidence: '', sources: [] };

    const ownershipDetails = normalizeOwnershipDetails(json?.ownershipDetails, sources);
    return {
      organizationStatus,
      ownershipAccountability,
      explanation: explanation || 'Web search did not find enough information about this company to confirm its ownership.',
      sources,
      organizationEvidence,
      ownershipEvidence,
      matchedLegalName: cleanText(json?.matchedLegalName, 180),
      matchedAddress: cleanText(json?.matchedAddress, 240),
      ownershipDetails,
      retrievedAt: new Date().toISOString(),
      // Unparseable replies are not remembered, so the next run gets a fresh attempt.
      failed: !json
    };
  } catch (error) {
    console.error('Contractor web research failed:', error);
    return { ...emptyCompanyResearch('Web research was unavailable; ownership was not verified.'), failed: true };
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
