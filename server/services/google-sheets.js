import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';

const scopes = [
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.email'
];
const pendingStates = new Map();
let intakeQueue = Promise.resolve();

function connectionFile() {
  return path.join(config.dataDir, 'google-sheets-connection.json');
}

function redirectUri() {
  return config.googleOAuthRedirectUri ||
    new URL('/api/admin/google-sheets/oauth/callback', config.publicBaseUrl).toString();
}

function adminReturnOrigin(value) {
  const fallback = new URL(config.publicBaseUrl).origin;
  if (!value) return fallback;
  let origin;
  try {
    const parsedValue = new URL(value);
    if (!['http:', 'https:'].includes(parsedValue.protocol)) return fallback;
    origin = parsedValue.origin;
  } catch {
    return fallback;
  }
  const allowedOrigins = [...config.corsOrigin.split(','), config.publicBaseUrl]
    .map((item) => {
      try {
        return new URL(item.trim()).origin;
      } catch {
        return '';
      }
    });
  const parsed = new URL(origin);
  const localDevelopmentOrigin = config.nodeEnv !== 'production' &&
    ['localhost', '127.0.0.1'].includes(parsed.hostname);
  return allowedOrigins.includes(origin) || localDevelopmentOrigin ? origin : fallback;
}

function assertOAuthConfigured() {
  if (
    !config.googleOAuthClientId ||
    !config.googleOAuthClientSecret ||
    config.googleOAuthEncryptionKey.length < 32
  ) {
    throw new Error('Google Drive OAuth is not configured on the server.');
  }
}

function encryptionKey() {
  assertOAuthConfigured();
  return crypto.scryptSync(
    config.googleOAuthEncryptionKey,
    'pro-trenchless-google-sheets-oauth-v1',
    32
  );
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return JSON.stringify({
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64')
  });
}

function decrypt(value) {
  const stored = JSON.parse(value);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(stored.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(stored.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(stored.data, 'base64')),
    decipher.final()
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}

async function readConnection() {
  try {
    return decrypt(await fs.readFile(connectionFile(), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error('Google Sheets connection data could not be read. Reconnect Google Drive.');
  }
}

async function writeConnection(value) {
  await fs.mkdir(config.dataDir, { recursive: true });
  const file = connectionFile();
  const temporaryFile = `${file}.tmp`;
  await fs.writeFile(temporaryFile, encrypt(value), { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temporaryFile, file);
}

export async function disconnectGoogleSheets() {
  try {
    await fs.unlink(connectionFile());
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export function createGoogleOAuthUrl(origin) {
  assertOAuthConfigured();
  const now = Date.now();
  for (const [state, expiresAt] of pendingStates) {
    if (expiresAt.expiresAt <= now) pendingStates.delete(state);
  }

  const state = crypto.randomBytes(32).toString('base64url');
  pendingStates.set(state, {
    expiresAt: now + 10 * 60 * 1000,
    returnOrigin: adminReturnOrigin(origin)
  });
  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizationUrl.search = new URLSearchParams({
    client_id: config.googleOAuthClientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
    state
  }).toString();
  return authorizationUrl.toString();
}

export async function completeGoogleOAuth({ code, state }) {
  assertOAuthConfigured();
  const pending = pendingStates.get(state);
  pendingStates.delete(state);
  if (!pending || pending.expiresAt <= Date.now()) {
    throw new Error('Google authorization expired. Please connect again.');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.googleOAuthClientId,
      client_secret: config.googleOAuthClientSecret,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code'
    }),
    signal: AbortSignal.timeout(15000)
  });
  const tokens = await response.json().catch(() => ({}));
  if (!response.ok || !tokens.access_token) {
    throw new Error('Google authorization failed. Check the OAuth client and callback URL.');
  }

  const previous = await readConnection();
  const refreshToken = tokens.refresh_token || previous?.refreshToken;
  if (!refreshToken) {
    throw new Error('Google did not provide a refresh token. Revoke this app in Google Account permissions and connect again.');
  }

  const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    signal: AbortSignal.timeout(10000)
  });
  const profile = profileResponse.ok ? await profileResponse.json() : {};

  await writeConnection({
    refreshToken,
    accessToken: tokens.access_token,
    accessTokenExpiresAt: Date.now() + Number(tokens.expires_in || 3600) * 1000,
    accountEmail: typeof profile.email === 'string' ? profile.email : previous?.accountEmail || '',
    selection: previous?.selection || null
  });
  return { returnOrigin: pending.returnOrigin };
}

async function getAccessToken() {
  assertOAuthConfigured();
  const connection = await readConnection();
  if (!connection?.refreshToken) {
    throw new Error('Connect a Google account in Admin Settings before accepting estimate submissions.');
  }
  if (connection.accessToken && connection.accessTokenExpiresAt > Date.now() + 60_000) {
    return { connection, accessToken: connection.accessToken };
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.googleOAuthClientId,
      client_secret: config.googleOAuthClientSecret,
      refresh_token: connection.refreshToken,
      grant_type: 'refresh_token'
    }),
    signal: AbortSignal.timeout(15000)
  });
  const tokens = await response.json().catch(() => ({}));
  if (!response.ok || !tokens.access_token) {
    throw new Error('Google account authorization expired. Reconnect Google Drive in Admin Settings.');
  }

  const updated = {
    ...connection,
    accessToken: tokens.access_token,
    accessTokenExpiresAt: Date.now() + Number(tokens.expires_in || 3600) * 1000
  };
  await writeConnection(updated);
  return { connection: updated, accessToken: tokens.access_token };
}

async function googleApi(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || `Google API request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return result;
}

async function withGoogleApi(callback) {
  const { connection, accessToken } = await getAccessToken();
  return callback(accessToken, connection);
}

export async function getGoogleSheetsStatus() {
  const oauthConfigured = Boolean(
    config.googleOAuthClientId &&
    config.googleOAuthClientSecret &&
    config.googleOAuthEncryptionKey.length >= 32
  );
  let connection = null;
  let connectionError = '';
  if (oauthConfigured) {
    try {
      connection = await readConnection();
    } catch (error) {
      connectionError = error.message;
    }
  }
  return {
    oauthConfigured,
    redirectUri: redirectUri(),
    connected: Boolean(connection?.refreshToken),
    accountEmail: connection?.accountEmail || '',
    selection: connection?.selection || null,
    connectionError
  };
}

export async function listGoogleSpreadsheets({ query = '', pageToken = '' } = {}) {
  return withGoogleApi(async (accessToken) => {
    const params = new URLSearchParams({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      pageSize: '100',
      orderBy: 'name',
      fields: 'nextPageToken,files(id,name,modifiedTime,webViewLink)'
    });
    const safeQuery = query.trim()
      .replace(/[\u0000-\u001f]/g, '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'");
    if (safeQuery) params.set('q', `${params.get('q')} and name contains '${safeQuery}'`);
    if (pageToken) params.set('pageToken', pageToken);
    return googleApi(`https://www.googleapis.com/drive/v3/files?${params}`, accessToken);
  });
}

export async function listSpreadsheetTabs(spreadsheetId) {
  if (!/^[\w-]{10,200}$/.test(spreadsheetId)) {
    throw new Error('Invalid spreadsheet selection.');
  }
  return withGoogleApi(async (accessToken) => {
    const params = new URLSearchParams({ fields: 'properties(title),sheets(properties(sheetId,title,index))' });
    const spreadsheet = await googleApi(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?${params}`,
      accessToken
    );
    return {
      spreadsheet: { id: spreadsheetId, name: spreadsheet.properties?.title || '' },
      tabs: (spreadsheet.sheets || []).map(({ properties }) => ({
        id: properties.sheetId,
        title: properties.title,
        index: properties.index
      }))
    };
  });
}

export async function selectGoogleSheet({ spreadsheetId, sheetId }) {
  const { spreadsheet, tabs } = await listSpreadsheetTabs(spreadsheetId);
  const selectedTab = tabs.find((tab) => tab.id === Number(sheetId));
  if (!selectedTab) throw new Error('Choose a tab from the selected spreadsheet.');

  return withGoogleApi(async (_accessToken, connection) => {
    const selection = {
      spreadsheetId,
      spreadsheetName: spreadsheet.name,
      sheetId: selectedTab.id,
      sheetTitle: selectedTab.title
    };
    await writeConnection({ ...connection, selection });
    return selection;
  });
}

async function appendIntake({ submissionId, customer }) {
  return withGoogleApi(async (accessToken, connection) => {
    const selection = connection.selection;
    if (!selection?.spreadsheetId || !selection?.sheetTitle) {
      throw new Error('Choose a Google spreadsheet and tab in Admin Settings before accepting estimate submissions.');
    }

    const range = `'${selection.sheetTitle.replace(/'/g, "''")}'`;
    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(selection.spreadsheetId)}/values`;
    const existing = await googleApi(`${baseUrl}/${encodeURIComponent(`${range}!A:A`)}`, accessToken);
    if ((existing.values || []).some(([value]) => String(value) === submissionId)) {
      return { duplicate: true };
    }

    const headers = await googleApi(`${baseUrl}/${encodeURIComponent(`${range}!A1:G1`)}`, accessToken);
    if (!headers.values?.[0]?.some(Boolean)) {
      await googleApi(`${baseUrl}/${encodeURIComponent(`${range}!A1:G1`)}?valueInputOption=RAW`, accessToken, {
        method: 'PUT',
        body: JSON.stringify({
          range: `${range}!A1:G1`,
          majorDimension: 'ROWS',
          values: [['Submission ID', 'Submitted At (UTC)', 'Customer Name', 'Street Address', 'City', 'State', 'ZIP Code']]
        })
      });
    }

    await googleApi(`${baseUrl}/${encodeURIComponent(`${range}!A:G`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, accessToken, {
      method: 'POST',
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values: [[
          submissionId,
          new Date().toISOString(),
          customer.customerName,
          customer.streetAddress,
          customer.city,
          customer.state,
          customer.zipCode
        ]]
      })
    });
    return { duplicate: false };
  });
}

export async function saveEstimateIntake(payload) {
  const pending = intakeQueue.then(() => appendIntake(payload));
  intakeQueue = pending.catch(() => {});
  return pending;
}
