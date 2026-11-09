/**
 * Local simulation of the retired-host activate path:
 * delete every CacheStorage cache, claim, unregister, navigate window clients.
 * Does not touch localStorage / IndexedDB / cookies.
 */
import { NEW_APP_ORIGIN } from '../retire-host.js';

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

async function runRetiredActivate({ cachesApi, clientsApi, registration, newOrigin }) {
  const keys = await cachesApi.keys();
  await Promise.all(keys.map(key => cachesApi.delete(key)));
  await clientsApi.claim();
  await registration.unregister();
  const windowClients = await clientsApi.matchAll({ type: 'window' });
  await Promise.all(windowClients.map(client => {
    const url = new URL(client.url);
    return client.navigate(newOrigin + url.pathname + url.search + url.hash);
  }));
}

console.log('\n=== Local SW clean-up simulation (retired host) ===');

const deleted = [];
const navigated = [];
let claimed = false;
let unregistered = false;

const cachesApi = {
  keys: async () => ['paws-modeller-v14', 'paws-modeller-v13', 'other-cache'],
  delete: async (key) => { deleted.push(key); return true; },
};

const clientsApi = {
  claim: async () => { claimed = true; },
  matchAll: async () => ([
    {
      url: 'https://paws-pwa.pages.dev/?ha=4&sp=sitka_spruce#results',
      navigate: async (dest) => { navigated.push(dest); },
    },
    {
      url: 'https://paws-pwa.pages.dev/index.html',
      navigate: async (dest) => { navigated.push(dest); },
    },
  ]),
};

const registration = {
  unregister: async () => { unregistered = true; return true; },
};

await runRetiredActivate({
  cachesApi,
  clientsApi,
  registration,
  newOrigin: NEW_APP_ORIGIN,
});

assert(deleted.length === 3, 'deletes every CacheStorage cache', 3, deleted.length);
assert(
  deleted.includes('paws-modeller-v14') && deleted.includes('other-cache'),
  'includes current and unrelated cache names',
  true,
  true,
);
assert(claimed === true, 'clients.claim() ran', true, claimed);
assert(unregistered === true, 'registration.unregister() ran', true, unregistered);
assert(
  navigated[0] === 'https://woodland-restoration.trigrammatic.com/?ha=4&sp=sitka_spruce#results',
  'navigates first client with query+hash',
  'https://woodland-restoration.trigrammatic.com/?ha=4&sp=sitka_spruce#results',
  navigated[0],
);
assert(
  navigated[1] === 'https://woodland-restoration.trigrammatic.com/index.html',
  'navigates second client path',
  'https://woodland-restoration.trigrammatic.com/index.html',
  navigated[1],
);

console.log(`\nretire-sw-cleanup: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
