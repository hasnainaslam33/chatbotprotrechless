import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { extractEstimate, synthesizeComparison } from '../services/estimate-extractor.js';
import { appendJsonl } from '../services/storage.js';
import { getSettings, isModuleEnabled } from '../services/settings.js';
import { cleanText } from '../utils/safe.js';
import { DISCLAIMER, MAX_ESTIMATES } from '../../src/lib/comparisonConfig.js';
import {
  assignLabels,
  buildContractor,
  buildContractorQuestions,
  buildFallbackSummary,
  buildKeyQuestionMatrix,
  deriveRisks,
  topRisks
} from '../../src/lib/comparisonScoring.js';

const router = express.Router();

const MODULE_KEY = 'estimate-review';

// Deliberately tighter than /api/chat: each request can fan out to several
// multimodal document extractions.
const comparisonLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'You have run several comparisons in a short time. Please wait a few minutes and try again.' }
});

const schema = z.object({
  userType: z.string().max(120).default('Homeowner'),
  sessionId: z.string().max(100).optional(),
  projectBasics: z.record(z.any()).optional().default({}),
  estimates: z
    .array(
      z.object({
        contractorName: z.string().max(160).optional().default(''),
        uploadedFileIds: z.array(z.string().max(100)).max(4).optional().default([]),
        pastedText: z.string().max(20000).optional().default(''),
        totalPrice: z.union([z.number(), z.string()]).optional().nullable()
      })
    )
    .min(1)
    .max(MAX_ESTIMATES)
});

function parsePrice(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

router.post('/', comparisonLimiter, async (req, res, next) => {
  try {
    const payload = schema.parse(req.body || {});

    const settings = await getSettings();
    if (!settings.aiEnabled) {
      return res.status(403).json({ error: 'Estimate analysis is currently turned off. Please try again later.' });
    }
    if (!(await isModuleEnabled(MODULE_KEY))) {
      return res.status(403).json({ error: 'The estimate comparison tool is currently turned off. Please try again later.' });
    }

    const usable = payload.estimates.filter(
      (estimate) => estimate.uploadedFileIds.length > 0 || cleanText(estimate.pastedText, 20000).length > 0
    );

    if (!usable.length) {
      return res.status(400).json({ error: 'Please upload at least one contractor estimate to continue.' });
    }

    const sessionId = cleanText(payload.sessionId, 100) || nanoid(12);
    const projectBasics = payload.projectBasics || {};

    // Extract every document in parallel — each call is self-contained and
    // never throws, so one unreadable PDF cannot fail the whole comparison.
    const extractions = await Promise.all(
      usable.map((estimate) =>
        extractEstimate({
          contractorName: estimate.contractorName,
          uploadedFileIds: estimate.uploadedFileIds,
          pastedText: estimate.pastedText,
          totalPrice: parsePrice(estimate.totalPrice),
          projectBasics
        })
      )
    );

    const contractors = extractions.map((result, index) => {
      const source = usable[index];
      const homeownerName = cleanText(source.contractorName, 160);
      const homeownerPrice = parsePrice(source.totalPrice);

      return buildContractor(
        {
          id: `contractor-${index + 1}`,
          // The homeowner's own label wins — they know which quote is which.
          contractorName: homeownerName || result.extraction.contractorName,
          totalPrice: homeownerPrice ?? result.extraction.totalPrice,
          proposedMethod: result.extraction.proposedMethod,
          fields: result.extraction.fields,
          warranties: result.extraction.warranties,
          repairOptions: result.extraction.repairOptions,
          documentNotes: result.extraction.documentNotes,
          fileName: result.fileName,
          extractionMode: result.mode,
          analyzed: result.mode === 'openai'
        },
        index
      );
    });

    assignLabels(contractors);

    const candidateRisks = deriveRisks(contractors);
    const synthesis = await synthesizeComparison({ contractors, candidateRisks: candidateRisks.slice(0, 24), projectBasics });

    const risks = topRisks(contractors, synthesis.risks, 5);
    const summary = synthesis.summary || buildFallbackSummary(contractors);

    const result = {
      sessionId,
      analyzedAt: new Date().toISOString(),
      mode: synthesis.mode,
      contractors,
      risks,
      keyQuestions: buildKeyQuestionMatrix(contractors),
      contractorQuestions: buildContractorQuestions(contractors),
      summary,
      disclaimer: DISCLAIMER
    };

    await appendJsonl('estimate-comparisons.jsonl', {
      id: nanoid(),
      sessionId,
      createdAt: result.analyzedAt,
      module: MODULE_KEY,
      userType: payload.userType,
      projectBasics,
      contractorCount: contractors.length,
      contractors: contractors.map((contractor) => ({
        id: contractor.id,
        contractorName: contractor.contractorName,
        fileName: contractor.fileName,
        extractionMode: contractor.extractionMode,
        totalPrice: contractor.totalPrice,
        overallScore: contractor.overallScore,
        missingCount: contractor.missingCount,
        warningCount: contractor.warningCount
      })),
      synthesisMode: synthesis.mode
    });

    res.json(result);
  } catch (error) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Some of the details sent were not in the expected format. Please review the form and try again.' });
    }
    next(error);
  }
});

export default router;
