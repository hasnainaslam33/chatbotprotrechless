import express from 'express';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { appendJsonl } from '../services/storage.js';
import { cleanText } from '../utils/safe.js';
import { getSettings } from '../services/settings.js';

const router = express.Router();

const schema = z.object({
  event: z.string().max(120),
  module: z.string().max(120).optional().default(''),
  userType: z.string().max(120).optional().default(''),
  page: z.string().max(500).optional().default(''),
  data: z.record(z.any()).optional().default({}),
  sessionId: z.string().max(120).optional().default('')
});

router.post('/', async (req, res, next) => {
  try {
    const settings = await getSettings();
    if (!settings.eventTrackingEnabled) return res.status(201).json({ ok: true, ignored: true });
    const payload = schema.parse(req.body || {});
    const record = {
      id: nanoid(),
      createdAt: new Date().toISOString(),
      ip: req.ip,
      userAgent: cleanText(req.headers['user-agent'], 500),
      ...payload
    };
    await appendJsonl('events.jsonl', record);
    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
