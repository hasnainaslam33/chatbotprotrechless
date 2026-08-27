import crypto from 'crypto';
import { config } from '../config.js';

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(value) {
  return crypto.createHmac('sha256', config.adminSessionSecret).update(value).digest('base64url');
}

export function createAdminToken() {
  const payload = {
    role: 'admin',
    iat: Date.now(),
    exp: Date.now() + config.adminSessionHours * 60 * 60 * 1000
  };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifyAdminToken(token = '') {
  const [body, signature] = String(token).split('.');
  if (!body || !signature) return false;
  if (sign(body) !== signature) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return payload.role === 'admin' && Number(payload.exp) > Date.now();
  } catch {
    return false;
  }
}

export function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const headerKey = req.headers['x-admin-key'] || '';
  const queryToken = req.query?.admin_token || '';
  const provided = bearer || headerKey || queryToken;

  const validApiKey = provided && provided === config.adminApiKey;
  const validToken = provided && verifyAdminToken(provided);

  if (!validApiKey && !validToken) {
    return res.status(401).json({ error: 'Unauthorized. Please log in to the admin dashboard.' });
  }

  return next();
}
