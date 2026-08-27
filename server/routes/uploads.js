import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { nanoid } from 'nanoid';
import { config } from '../config.js';
import { appendJsonl } from '../services/storage.js';
import { cleanText } from '../utils/safe.js';
import { getSettings, isModuleEnabled } from '../services/settings.js';

const router = express.Router();

const allowedMimePrefixes = ['image/', 'video/', 'text/'];
const allowedExactMimes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip'
];

function isAllowedMime(mime = '') {
  return allowedExactMimes.includes(mime) || allowedMimePrefixes.some((prefix) => mime.startsWith(prefix));
}

await fs.mkdir(config.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: config.uploadDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 12);
    cb(null, `${Date.now()}-${nanoid(10)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedMime(file.mimetype)) {
      return cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
    return cb(null, true);
  }
});

router.post('/', upload.array('files', 8), async (req, res, next) => {
  try {
    const moduleKey = cleanText(req.body?.module, 120);
    const settings = await getSettings();
    if (!settings.uploadsEnabled) return res.status(403).json({ error: 'File uploads are currently disabled by admin settings.' });
    if (!(await isModuleEnabled(moduleKey))) return res.status(403).json({ error: 'This module is currently disabled by admin settings.' });

    const files = [];

    for (const file of req.files || []) {
      const record = {
        id: nanoid(),
        createdAt: new Date().toISOString(),
        originalName: cleanText(file.originalname, 300),
        storedName: file.filename,
        path: file.path,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        module: moduleKey,
        userType: cleanText(req.body?.userType, 120),
        sourcePage: cleanText(req.body?.sourcePage, 500)
      };
      await appendJsonl('uploads.jsonl', record);
      files.push({
        id: record.id,
        originalName: record.originalName,
        mimeType: record.mimeType,
        sizeBytes: record.sizeBytes
      });
    }

    res.status(201).json({ ok: true, files });
  } catch (error) {
    next(error);
  }
});

export default router;
