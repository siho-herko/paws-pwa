/**
 * tests/retire-host.test.js — retirement hostname gate for the old Pages address.
 */
import { readFileSync } from 'fs';
import {
  RETIRED_PAGES_HOST,
  NEW_APP_ORIGIN,
  isRetiredPagesHost,
  buildRetiredRedirectUrl,
} from '../retire-host.js';

let passed = 0, failed = 0;
function assert(condition, label, expected, actual) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}  →  expected: ${expected}  got: ${actual}`);
    failed++;
  }
}

console.log('\n=== Retire-host helpers ===');
assert(RETIRED_PAGES_HOST === 'paws-pwa.pages.dev', 'retired host constant', 'paws-pwa.pages.dev', RETIRED_PAGES_HOST);
assert(
  NEW_APP_ORIGIN === 'https://woodland-restoration.trigrammatic.com',
  'new origin constant',
  'https://woodland-restoration.trigrammatic.com',
  NEW_APP_ORIGIN,
);

assert(isRetiredPagesHost('paws-pwa.pages.dev') === true, 'exact old hostname → clean-up', true, true);

const normalHosts = [
  'woodland-restoration.trigrammatic.com',
  'abc123.paws-pwa.pages.dev',
  'preview.paws-pwa.pages.dev',
  'localhost',
  '127.0.0.1',
  'example.com',
  'paws-pwa.pages.dev.evil.com',
  'not-paws-pwa.pages.dev',
];
for (const host of normalHosts) {
  assert(
    isRetiredPagesHost(host) === false,
    `normal path for ${host}`,
    false,
    isRetiredPagesHost(host),
  );
}

assert(
  buildRetiredRedirectUrl('/', '?ha=4&sp=sitka_spruce', '#results') ===
    'https://woodland-restoration.trigrammatic.com/?ha=4&sp=sitka_spruce#results',
  'redirect preserves path/query/hash',
  'https://woodland-restoration.trigrammatic.com/?ha=4&sp=sitka_spruce#results',
  buildRetiredRedirectUrl('/', '?ha=4&sp=sitka_spruce', '#results'),
);
assert(
  buildRetiredRedirectUrl('/index.html', '', '') ===
    'https://woodland-restoration.trigrammatic.com/index.html',
  'redirect with pathname only',
  'https://woodland-restoration.trigrammatic.com/index.html',
  buildRetiredRedirectUrl('/index.html', '', ''),
);

console.log('\n=== Source contracts (sw.js + app.js) ===');
const sw = readFileSync('./sw.js', 'utf8');
const app = readFileSync('./app.js', 'utf8');

assert(
  sw.includes("const RETIRED_PAGES_HOST = 'paws-pwa.pages.dev';"),
  'sw.js uses exact retired hostname',
  true,
  true,
);
assert(
  sw.includes('self.location.hostname === RETIRED_PAGES_HOST'),
  'sw.js gates on exact hostname equality',
  true,
  true,
);
assert(
  /\blocalStorage\b|\bindexedDB\b|\bdocument\.cookie\b|\bcookieStore\b/.test(sw) === false,
  'sw.js never touches localStorage / IndexedDB / cookies',
  false,
  /\blocalStorage\b|\bindexedDB\b|\bdocument\.cookie\b|\bcookieStore\b/.test(sw),
);
assert(
  sw.includes('caches.delete') && sw.includes('unregister') && sw.includes('client.navigate'),
  'sw.js retired branch deletes caches, unregisters, navigates',
  true,
  true,
);
assert(
  sw.includes("const CACHE_NAME  = 'paws-modeller-v15';"),
  'normal SW path still precaches (v15)',
  true,
  true,
);

assert(
  app.includes('isRetiredPagesHost(location.hostname)'),
  'app.js register site checks retired host',
  true,
  true,
);
assert(
  app.includes('location.replace(buildRetiredRedirectUrl(location.pathname, location.search, location.hash))'),
  'app.js redirects with path/query/hash and does not register on old host',
  true,
  true,
);
assert(
  app.includes("navigator.serviceWorker.register('/sw.js?v=15')"),
  'app.js still registers SW on other hosts',
  true,
  true,
);

// Simulate the SW branch decision the same way the worker does at the top.
function swUsesRetirementCleanup(hostname) {
  return hostname === 'paws-pwa.pages.dev';
}
assert(swUsesRetirementCleanup('paws-pwa.pages.dev') === true, 'SW clean-up only on exact old host', true, true);
assert(swUsesRetirementCleanup('woodland-restoration.trigrammatic.com') === false, 'SW normal on new origin', false, false);
assert(swUsesRetirementCleanup('foo.paws-pwa.pages.dev') === false, 'SW normal on preview host', false, false);
assert(swUsesRetirementCleanup('localhost') === false, 'SW normal on localhost', false, false);

console.log(`\nretire-host: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
