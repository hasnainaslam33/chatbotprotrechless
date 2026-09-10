import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import sgMail from '@sendgrid/mail';
import { config } from '../config.js';
import { extractEstimate, synthesizeComparison } from '../services/estimate-extractor.js';
import { appendJsonl, readJsonl } from '../services/storage.js';
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
  customer: z
    .object({
      customerName: z.string().min(1).max(160),
      streetAddress: z.string().min(1).max(220),
      city: z.string().min(1).max(120),
      state: z.string().min(1).max(80),
      zipCode: z.string().min(3).max(12)
    })
    .optional()
    .default({
      customerName: '',
      streetAddress: '',
      city: '',
      state: '',
      zipCode: ''
    }),
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

router.get('/report/:reportId/:token', async (req, res) => {
  try {
    const { reportId, token } = req.params;
    const rows = await readJsonl('estimate-comparisons.jsonl', 5000);
    const match = rows.find((row) => row.reportId === reportId && row.reportToken === token);
    if (!match) return res.status(404).json({ error: 'Comparison not found.' });
    res.json(match.comparison || match);
  } catch (error) {
    res.status(500).json({ error: 'Unable to load this comparison.' });
  }
});

router.post('/email/:reportId/:token', async (req, res) => {
  try {
    const { reportId, token } = req.params;
    const { toEmail, fromEmail } = req.body || {};
    const rows = await readJsonl('estimate-comparisons.jsonl', 5000);
    const match = rows.find((row) => row.reportId === reportId && row.reportToken === token);
    if (!match) return res.status(404).json({ error: 'Comparison not found.' });

    const comparison = match.comparison || match;
    const customer = comparison.customer || {};
    const address = [customer.streetAddress, customer.city, customer.state, customer.zipCode].filter(Boolean).join(', ');
    const recommended = comparison.contractors?.[0] || {};

    const subject = 'Your Sewer Proposal Comparison';
    const customerName = customer.customerName || 'Customer';
    const body = `Hi ${customerName},\n\nWe reviewed the proposals for:\n${address}\n\nYour comparison is ready.\n\nOverall result:\n${recommended.contractorName || 'Recommended company'}\n${recommended.proposedMethod || 'Recommended option'}\n${recommended.overallScore ?? '0'}/100\n\nYou can review:\n- Company scores\n- Prices\n- Good / Better / Best options\n- Warranty\n- Satisfaction guarantees\n- Possible extra costs\n- Questions to ask before signing\n\nVIEW MY COMPARISON\n${comparison.reportUrl || 'https://answers.protrenchless.com'}\n\nWould you like a free trenchless camera inspection before you decide?\n\nREQUEST FREE CAMERA INSPECTION\nhttps://answers.protrenchless.com/#lead-form\n\nRegards,\n${config.businessName || 'Pro Trenchless Services'}`;

    if (!config.sendgridApiKey || !config.notifyEmailFrom || !toEmail) {
      return res.json({ ok: true, preview: { subject, body }, note: 'SendGrid is not configured. Email preview generated only.' });
    }

    sgMail.setApiKey(config.sendgridApiKey);
    await sgMail.send({
      to: toEmail,
      from: fromEmail || config.notifyEmailFrom,
      subject,
      text: body
    });

    res.json({ ok: true, sent: true, subject, to: toEmail });
  } catch (error) {
    res.status(500).json({ error: 'Unable to send this email.' });
  }
});

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
    const customer = {
      customerName: cleanText(payload.customer?.customerName, 160),
      streetAddress: cleanText(payload.customer?.streetAddress, 220),
      city: cleanText(payload.customer?.city, 120),
      state: cleanText(payload.customer?.state, 80),
      zipCode: cleanText(payload.customer?.zipCode, 12)
    };

    if (!customer.customerName || !customer.streetAddress || !customer.city || !customer.state || !customer.zipCode) {
      return res.status(400).json({ error: 'Customer name, street address, city, state, and ZIP code are required before a comparison can be generated.' });
    }

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

    const reportId = nanoid(10);
    const reportToken = nanoid(32);
    const analyzedAt = new Date().toISOString();

    const result = {
      sessionId,
      reportId,
      reportToken,
      reportDate: analyzedAt,
      customer,
      customerAddress: `${customer.streetAddress}, ${customer.city}, ${customer.state} ${customer.zipCode}`,
      reportUrl: `${config.publicBaseUrl}/comparison/${reportId}/${reportToken}`,
      analyzedAt,
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
      reportId,
      reportToken,
      sessionId,
      createdAt: analyzedAt,
      updatedAt: analyzedAt,
      module: MODULE_KEY,
      userType: payload.userType,
      customer,
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
      synthesisMode: synthesis.mode,
      comparison: result
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
