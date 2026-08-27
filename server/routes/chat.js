import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { createAiAnswer } from '../services/openai-client.js';
import { appendJsonl } from '../services/storage.js';
import { getModuleConfig } from '../services/module-config.js';
import { getSettings, isModuleEnabled } from '../services/settings.js';
import { cleanText } from '../utils/safe.js';

const router = express.Router();

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

const schema = z.object({
  module: z.string().max(120).default('symptom-checker'),
  userType: z.string().max(120).default('Homeowner'),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']).default('user'),
    content: z.string().max(8000)
  })).min(1).max(30),
  formContext: z.record(z.any()).optional().default({}),
  uploadedFileIds: z.array(z.string().max(100)).optional().default([]),
  sessionId: z.string().max(100).optional()
});

router.post('/', chatLimiter, async (req, res, next) => {
  try {
    const payload = schema.parse(req.body || {});
    const settings = await getSettings();
    if (!settings.aiEnabled) return res.status(403).json({ error: 'AI responses are currently disabled by admin settings.' });
    if (!(await isModuleEnabled(payload.module))) return res.status(403).json({ error: 'This module is currently disabled by admin settings.' });
    const sessionId = cleanText(payload.sessionId, 100) || nanoid(12);
    const result = await createAiAnswer(payload);
    const moduleInfo = getModuleConfig(payload.module);

    const record = {
      id: nanoid(),
      sessionId,
      createdAt: new Date().toISOString(),
      module: payload.module,
      userType: payload.userType,
      messages: payload.messages,
      uploadedFileIds: payload.uploadedFileIds,
      mode: result.mode,
      model: result.model,
      responseId: result.responseId || null
    };
    await appendJsonl('chats.jsonl', record);

    res.json({
      sessionId,
      answer: result.answer,
      structuredAnswer: result.structuredAnswer || null,
      mode: result.mode,
      model: result.model,
      links: result.structuredAnswer?.links?.length ? result.structuredAnswer.links : moduleInfo.links,
      disclaimer: 'This AI tool provides educational guidance only. Final diagnosis, repair method, pricing, code compliance, permits, and safety decisions require professional inspection and verification.'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
