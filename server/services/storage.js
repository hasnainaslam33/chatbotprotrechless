import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';
import { parseJsonLine } from '../utils/safe.js';

async function ensureDirs() {
  await fs.mkdir(config.dataDir, { recursive: true });
  await fs.mkdir(config.uploadDir, { recursive: true });
}

export async function appendJsonl(fileName, record) {
  await ensureDirs();
  const filePath = path.join(config.dataDir, fileName);
  await fs.appendFile(filePath, JSON.stringify(record) + '\n', 'utf8');
  return record;
}

export async function readJsonl(fileName, limit = 200) {
  await ensureDirs();
  const filePath = path.join(config.dataDir, fileName);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const rows = raw.split('\n').filter(Boolean).map(parseJsonLine).filter(Boolean);
    return rows.slice(-limit).reverse();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function findUpload(uploadId) {
  const uploads = await readJsonl('uploads.jsonl', 10000);
  return uploads.find((item) => item.id === uploadId) || null;
}

export async function getCounts() {
  const [leads, events, uploads] = await Promise.all([
    readJsonl('leads.jsonl', 100000),
    readJsonl('events.jsonl', 100000),
    readJsonl('uploads.jsonl', 100000)
  ]);
  return {
    leads: leads.length,
    events: events.length,
    uploads: uploads.length,
    recentLeads: leads.slice(0, 10)
  };
}
