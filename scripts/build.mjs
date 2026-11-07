/**
 * Build the Cloudflare Pages output without publishing source registers or tests.
 */
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
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

// _headers caches scripts and styles as immutable for a year, so every local
// reference to them must carry ?v=N, and N must match CACHE_NAME's version.
const sw = await readFile(path.join(root, 'sw.js'), 'utf8');
const cacheVersion = sw.match(/CACHE_NAME\s*=\s*'paws-modeller-v(\d+)'/)?.[1];
for (const file of ['index.html', 'app.js', 'sw.js']) {
  const text = await readFile(path.join(root, file), 'utf8');
  for (const [, ref, v] of text.matchAll(/["'](?:\.?\/)?((?:styles\/)?[\w-]+\.(?:js|css))(?:\?v=(\d+))?["']/g)) {
    if (v !== cacheVersion) throw new Error(`${file}: ${ref} must use ?v=${cacheVersion}, found ${v ? `?v=${v}` : 'no version'}`);
  }
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of appFiles) {
  await cp(path.join(root, entry), path.join(output, entry), { recursive: true });
}

// A top-level 404 disables Pages' SPA fallback, so omitted source paths stay unavailable.
await cp(path.join(root, 'index.html'), path.join(output, '404.html'));

console.log(`Built ${appFiles.length} app entries and 404.html in ${output}`);
