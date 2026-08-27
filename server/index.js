import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { config } from './config.js';
import chatRoutes from './routes/chat.js';
import leadRoutes from './routes/leads.js';
import uploadRoutes from './routes/uploads.js';
import adminRoutes from './routes/admin.js';
import eventRoutes from './routes/events.js';
import moduleRoutes from './routes/modules.js';
import estimateComparisonRoutes from './routes/estimate-comparison.js';

await fs.mkdir(config.dataDir, { recursive: true });
await fs.mkdir(config.uploadDir, { recursive: true });

const app = express();

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin(origin, cb) {
    if (!origin || config.corsOrigin === '*' || origin === config.corsOrigin || origin === config.publicBaseUrl) return cb(null, true);
    return cb(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    app: 'Instant Sewer & Drain Answers',
    time: new Date().toISOString(),
    envPath: config.envPath,
    openaiKey: config.openaiApiKeyMasked,
    openaiModel: config.openaiModel
  });
});

app.get('/api/debug/env', (_req, res) => {
  res.json({
    envPath: config.envPath,
    openaiKey: config.openaiApiKeyMasked,
    openaiModel: config.openaiModel,
    note: 'This only shows a masked key for safety.'
  });
});

app.use('/api/chat', chatRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/modules', moduleRoutes);
app.use('/api/estimate-comparison', estimateComparisonRoutes);

const distDir = path.join(config.rootDir, 'dist');
const uiEntry = path.join(distDir, 'index.html');
const fallbackEntry = path.join(config.publicDir, 'index.html');

app.use(express.static(distDir, {
  maxAge: config.nodeEnv === 'production' ? '1h' : 0
}));
app.use(express.static(config.publicDir, {
  extensions: ['html'],
  maxAge: config.nodeEnv === 'production' ? '1h' : 0
}));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const entryPath = existsSync(uiEntry) ? uiEntry : fallbackEntry;
  res.sendFile(entryPath);
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = error.status || error.statusCode || 500;
  const message = status >= 500 ? 'Server error. Check backend logs.' : error.message;
  res.status(status).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`Instant Sewer & Drain Answers running on ${config.publicBaseUrl || `http://localhost:${config.port}`}`);
  console.log(`Admin API: /api/admin with x-admin-key header`);
  console.log(`Loaded env file: ${config.envPath}`);
  console.log(`OpenAI key loaded: ${config.openaiApiKeyMasked}`);
  console.log(`OpenAI model: ${config.openaiModel}`);
  if (!config.openaiApiKey) console.log('OPENAI_API_KEY missing. Backend will use local fallback answers until a key is added.');
});
