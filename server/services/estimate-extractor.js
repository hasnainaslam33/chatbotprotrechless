/**
 * AI extraction + synthesis for the Three-Quote Sewer Estimate Comparison Tool.
 *
 * Reuses the existing OpenAI Responses integration and the existing upload
 * pipeline (server/routes/uploads.js) — nothing new is introduced on the
 * infrastructure side. If no API key is configured, or a call fails, every
 * field degrades to `not_stated` so the UI still renders honestly rather than
 * inventing scope.
 */

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

    if (!extraction) {
      return {
        mode: 'parse-error',
        extraction: emptyExtraction("We couldn't read this estimate reliably. Try uploading a clearer PDF or image."),
        fileName
      };
    }

    return { mode: 'openai', extraction, fileName, responseId: response.id || null };
  } catch (error) {
    console.error('Estimate extraction failed:', error);
    return {
      mode: 'error',
      extraction: emptyExtraction(
        "We couldn't read this estimate. Try uploading a clearer PDF or image, or paste the estimate text instead."
      ),
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
