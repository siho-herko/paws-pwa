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
  'images',
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

// A top-level 404 disables Pages' SPA fallback, so omitted source paths stay unavailable.
await cp(path.join(root, 'index.html'), path.join(output, '404.html'));

console.log(`Built ${appFiles.length} app entries and 404.html in ${output}`);
