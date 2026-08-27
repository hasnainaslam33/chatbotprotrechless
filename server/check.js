import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js';

const required = [
  'public/index.html',
  'public/js/app.js',
  'server/index.js',
  'server/routes/chat.js',
  'server/routes/leads.js',
  'server/routes/uploads.js',
  'server/routes/admin.js',
  '.env.example'
];

let ok = true;
for (const rel of required) {
  try {
    await fs.access(path.join(config.rootDir, rel));
    console.log(`OK ${rel}`);
  } catch {
    ok = false;
    console.error(`Missing ${rel}`);
  }
}

if (!ok) process.exit(1);
console.log('Project file check passed. Run npm install, then npm run dev.');
