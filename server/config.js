import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');

// Force this app to read the .env file inside this project folder.
// override:true fixes the common Windows issue where an old system-level
// OPENAI_API_KEY keeps winning over the new key saved in .env.
dotenv.config({ path: envPath, override: true });

function intEnv(name, fallback) {
  const raw = process.env[name];
  const parsed = Number.parseInt(raw || '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function maskSecret(value = '') {
  if (!value) return 'MISSING';
  if (value.length <= 14) return `${value.slice(0, 4)}...`;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

export const config = {
  rootDir,
  envPath,
  publicDir: path.join(rootDir, 'public'),
  dataDir: path.join(rootDir, process.env.DATA_DIR || 'data'),
  uploadDir: path.join(rootDir, process.env.UPLOAD_DIR || 'uploads'),
  port: intEnv('PORT', 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3000',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  adminApiKey: process.env.ADMIN_API_KEY || 'change-this-long-random-admin-key',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin12345',
  adminSessionSecret: process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_API_KEY || 'change-this-long-random-admin-session-secret',
  adminSessionHours: intEnv('ADMIN_SESSION_HOURS', 12),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiApiKeyMasked: maskSecret(process.env.OPENAI_API_KEY || ''),
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  aiTemperature: Number(process.env.AI_TEMPERATURE || 0.25),
  maxUploadMb: intEnv('MAX_UPLOAD_MB', 75),
  maxVisionImages: intEnv('MAX_VISION_IMAGES', 8),
  maxVisionImageMb: intEnv('MAX_VISION_IMAGE_MB', 18),
  visionDetail: process.env.VISION_DETAIL || 'high',
  maxInputFiles: intEnv('MAX_INPUT_FILES', 4),
  maxInputFileBytes: intEnv('MAX_INPUT_FILE_BYTES', 45 * 1024 * 1024),
  fileDetail: process.env.FILE_DETAIL || 'high',
  leadWebhookUrl: process.env.LEAD_WEBHOOK_URL || '',
  leadWebhookSecret: process.env.LEAD_WEBHOOK_SECRET || '',
  sendgridApiKey: process.env.SENDGRID_API_KEY || '',
  notifyEmailTo: process.env.NOTIFY_EMAIL_TO || '',
  notifyEmailFrom: process.env.NOTIFY_EMAIL_FROM || '',
  businessName: process.env.BUSINESS_NAME || 'Pro Trenchless Services',
  businessPhone: process.env.BUSINESS_PHONE || '(484) 206-5551',
  mainSiteUrl: process.env.MAIN_SITE_URL || 'https://protrenchless.com',
  aiSiteUrl: process.env.AI_SITE_URL || 'https://answers.protrenchless.com'
};
