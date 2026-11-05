import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config.js';
import { readJsonl, getCounts, findUpload } from '../services/storage.js';
import { getSettings, publicSettings, updateSettings } from '../services/settings.js';
import { requireAdmin, createAdminToken } from '../utils/auth.js';
import {
  completeGoogleOAuth,
  createGoogleOAuthUrl,
  disconnectGoogleSheets,
  getGoogleSheetsStatus,
  listGoogleSpreadsheets,
  listSpreadsheetTabs,
  selectGoogleSheet
} from '../services/google-sheets.js';

const router = express.Router();

function cleanDownloadName(value = 'download') {
  return String(value).replace(/[\r\n]/g, '').slice(0, 220) || 'download';
}

router.post('/login', async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '').trim();
  const adminKey = String(req.body?.adminKey || '').trim();

  const keyLogin = adminKey && adminKey === config.adminApiKey;
  const userLogin = username === config.adminUsername && password === config.adminPassword;

  if (!keyLogin && !userLogin) {
    return res.status(401).json({ error: 'Invalid admin login. Check ADMIN_USERNAME and ADMIN_PASSWORD in .env.' });
  }

  res.json({
    ok: true,
    token: createAdminToken(),
    expiresHours: config.adminSessionHours,
    user: { username: config.adminUsername, role: 'admin' }
  });
});

router.get('/google-sheets/oauth/callback', async (req, res) => {
  if (req.query.error) return res.redirect('/admin/?googleSheets=error');
  try {
    const result = await completeGoogleOAuth({
      code: String(req.query.code || ''),
      state: String(req.query.state || '')
    });
    res.redirect(`${result.returnOrigin}/admin/?googleSheets=connected`);
  } catch (error) {
    console.error('Google Sheets OAuth callback failed:', error);
    res.redirect('/admin/?googleSheets=error');
  }
});

router.use(requireAdmin);

router.get('/me', (_req, res) => {
  res.json({ ok: true, user: { username: config.adminUsername, role: 'admin' } });
});

router.get('/stats', async (_req, res, next) => {
  try {
    const counts = await getCounts();
    const chats = await readJsonl('chats.jsonl', 100000);
    res.json({ ...counts, chats: chats.length });
  } catch (error) {
    next(error);
  }
});

router.get('/activity', async (req, res, next) => {
  try {
    const limit = Math.min(Number.parseInt(req.query.limit || '200', 10), 1000);
    const [events, chats, leads, uploads] = await Promise.all([
      readJsonl('events.jsonl', limit),
      readJsonl('chats.jsonl', limit),
      readJsonl('leads.jsonl', limit),
      readJsonl('uploads.jsonl', limit)
    ]);
    const rows = [
      ...events.map(item => ({ type: 'event', title: item.event, module: item.module, userType: item.userType, createdAt: item.createdAt, details: item.data || {}, sessionId: item.sessionId || '' })),
      ...chats.map(item => ({ type: 'chat', title: item.mode || 'AI chat', module: item.module, userType: item.userType, createdAt: item.createdAt, details: { model: item.model, uploads: item.uploadedFileIds?.length || 0 }, sessionId: item.sessionId || '' })),
      ...leads.map(item => ({ type: 'lead', title: item.name || item.email || item.phone || 'Lead submitted', module: item.module, userType: item.userType, createdAt: item.createdAt, details: { urgency: item.urgency, phone: item.phone, email: item.email }, sessionId: item.sessionId || '' })),
      ...uploads.map(item => ({ type: 'upload', title: item.originalName, module: item.module, userType: item.userType, createdAt: item.createdAt, details: { mimeType: item.mimeType, sizeBytes: item.sizeBytes }, sessionId: '' }))
    ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, limit);
    res.json({ activity: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/leads', async (req, res, next) => {
  try {
    const limit = Number.parseInt(req.query.limit || '200', 10);
    res.json({ leads: await readJsonl('leads.jsonl', Math.min(limit, 1000)) });
  } catch (error) {
    next(error);
  }
});

router.get('/chats', async (req, res, next) => {
  try {
    const limit = Number.parseInt(req.query.limit || '200', 10);
    res.json({ chats: await readJsonl('chats.jsonl', Math.min(limit, 1000)) });
  } catch (error) {
    next(error);
  }
});

router.get('/events', async (req, res, next) => {
  try {
    const limit = Number.parseInt(req.query.limit || '200', 10);
    res.json({ events: await readJsonl('events.jsonl', Math.min(limit, 1000)) });
  } catch (error) {
    next(error);
  }
});

router.get('/uploads', async (req, res, next) => {
  try {
    const limit = Number.parseInt(req.query.limit || '200', 10);
    const uploads = await readJsonl('uploads.jsonl', Math.min(limit, 1000));
    res.json({ uploads: uploads.map(({ path: _path, ...safe }) => safe) });
  } catch (error) {
    next(error);
  }
});

router.get('/uploads/:id/download', async (req, res, next) => {
  try {
    const upload = await findUpload(req.params.id);
    if (!upload) return res.status(404).json({ error: 'Upload not found' });
    const filePath = path.resolve(upload.path);
    await fs.access(filePath);
    res.download(filePath, cleanDownloadName(upload.originalName));
  } catch (error) {
    next(error);
  }
});

router.get('/settings', async (_req, res, next) => {
  try {
    res.json({ settings: await getSettings() });
  } catch (error) {
    next(error);
  }
});

router.get('/google-sheets/status', async (_req, res, next) => {
  try {
    res.json(await getGoogleSheetsStatus());
  } catch (error) {
    next(error);
  }
});

router.get('/google-sheets/oauth-url', (req, res) => {
  try {
    res.json({ url: createGoogleOAuthUrl(req.get('origin')) });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

router.get('/google-sheets/spreadsheets', async (req, res, next) => {
  try {
    const result = await listGoogleSpreadsheets({
      query: String(req.query.q || '').slice(0, 100),
      pageToken: String(req.query.pageToken || '')
    });
    res.json({
      spreadsheets: result.files || [],
      nextPageToken: result.nextPageToken || ''
    });
  } catch (error) {
    next(error);
  }
});

router.get('/google-sheets/spreadsheets/:id/tabs', async (req, res, next) => {
  try {
    res.json(await listSpreadsheetTabs(req.params.id));
  } catch (error) {
    next(error);
  }
});

router.put('/google-sheets/selection', async (req, res, next) => {
  try {
    const { spreadsheetId, sheetId } = req.body || {};
    if (typeof spreadsheetId !== 'string' || !Number.isInteger(Number(sheetId))) {
      return res.status(400).json({ error: 'Choose a spreadsheet and tab.' });
    }
    const selection = await selectGoogleSheet({ spreadsheetId, sheetId });
    res.json({ ok: true, selection });
  } catch (error) {
    next(error);
  }
});

router.delete('/google-sheets/connection', async (_req, res, next) => {
  try {
    await disconnectGoogleSheets();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const settings = await updateSettings(req.body?.settings || req.body || {});
    res.json({ ok: true, settings });
  } catch (error) {
    next(error);
  }
});

router.get('/public-settings-preview', async (_req, res, next) => {
  try {
    res.json({ settings: publicSettings(await getSettings()) });
  } catch (error) {
    next(error);
  }
});

export default router;
