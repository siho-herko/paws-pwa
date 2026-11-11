import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const source = readFileSync(path.join(root, 'functions/_middleware.js'), 'utf8');
assert.match(source, /paws-pwa\.pages\.dev/);
assert.match(source, /woodland-restoration\.trigrammatic\.com/);
assert.match(source, /Response\.redirect\([^,]+,\s*301\)/);
assert.match(source, /url\.hostname === RETIRED_HOST/);

// Evaluate middleware with a stub context
const mod = await import(pathToFileURL(path.join(root, 'functions/_middleware.js')).href);
async function run(host, pathname = '/', search = '') {
  const request = { url: `https://${host}${pathname}${search}` };
  let nextCalled = false;
  const context = {
    request,
    next: async () => {
      nextCalled = true;
      return new Response('next');
    },
  };
  const res = await mod.onRequest(context);
  return { res, nextCalled };
}

{
  const { res, nextCalled } = await run('paws-pwa.pages.dev', '/foo', '?x=1');
  assert.equal(nextCalled, false);
  assert.equal(res.status, 301);
  assert.equal(res.headers.get('Location'), 'https://woodland-restoration.trigrammatic.com/foo?x=1');
}
{
  const { res, nextCalled } = await run('woodland-restoration.trigrammatic.com', '/foo', '?x=1');
  assert.equal(nextCalled, true);
  assert.equal(await res.text(), 'next');
}
{
  const { res, nextCalled } = await run('17a69011.paws-pwa.pages.dev', '/');
  assert.equal(nextCalled, true);
}

console.log('pages-middleware-redirect: ok');
