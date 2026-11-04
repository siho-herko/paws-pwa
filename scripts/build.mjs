/**
 * Build the Cloudflare Pages output without publishing source registers or tests.
 */
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'public');
const appFiles = [
  '_headers',
  'app.js',
  'calc.js',
  'charts.js',
  'data',
  'db.js',
  'icons',
  'index.html',
  'manifest.json',
  'styles',
  'sw.js',
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of appFiles) {
  await cp(path.join(root, entry), path.join(output, entry), { recursive: true });
}

console.log(`Built ${appFiles.length} app entries in ${output}`);
