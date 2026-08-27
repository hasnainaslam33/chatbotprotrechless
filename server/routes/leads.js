import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { appendJsonl } from '../services/storage.js';
import { routeLead } from '../services/lead-router.js';
import { cleanText } from '../utils/safe.js';
import { getSettings, isModuleEnabled } from '../services/settings.js';

const router = express.Router();

const leadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
});

const schema = z.object({
  name: z.string().max(200).optional().default(''),
  phone: z.string().max(100).optional().default(''),
  email: z.string().email().or(z.literal('')).optional().default(''),
  propertyAddress: z.string().max(500).optional().default(''),
  preferredAppointmentTime: z.string().max(300).optional().default(''),
  userType: z.string().max(120).optional().default('Homeowner'),
  module: z.string().max(120).optional().default('general'),
  problemType: z.string().max(200).optional().default(''),
  urgency: z.string().max(100).optional().default(''),
  message: z.string().max(10000).optional().default(''),
  resultSummary: z.string().max(10000).optional().default(''),
  consent: z.boolean().optional().default(false),
  uploadedFileIds: z.array(z.string().max(100)).optional().default([]),
  sourcePage: z.string().max(500).optional().default('')
});

router.post('/', leadLimiter, async (req, res, next) => {
  try {
    const payload = schema.parse(req.body || {});
    const settings = await getSettings();
    if (!settings.leadsEnabled) return res.status(403).json({ error: 'Lead capture is currently disabled by admin settings.' });
    if (!(await isModuleEnabled(payload.module))) return res.status(403).json({ error: 'This module is currently disabled by admin settings.' });

    if (settings.requireLeadConsent && !payload.consent) {
      return res.status(400).json({ error: 'Consent is required before Pro Trenchless can contact this lead.' });
    }

    if (!payload.phone && !payload.email) {
      return res.status(400).json({ error: 'Please provide at least a phone number or email.' });
    }

    const lead = {
      id: nanoid(),
      createdAt: new Date().toISOString(),
      ip: req.ip,
      userAgent: cleanText(req.headers['user-agent'], 500),
      ...payload
    };

    await appendJsonl('leads.jsonl', lead);
    const routeResult = await routeLead(lead);

    res.status(201).json({
      ok: true,
      leadId: lead.id,
      routing: routeResult,
      message: 'Request received. Pro Trenchless can review this lead in the backend admin area or connected CRM.'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
