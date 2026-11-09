/**
 * retire-host.js — helpers for retiring paws-pwa.pages.dev.
 * Keep the hostname string in sw.js identical (classic SW cannot import this module).
 */

export const RETIRED_PAGES_HOST = 'paws-pwa.pages.dev';
export const NEW_APP_ORIGIN = 'https://woodland-restoration.trigrammatic.com';

/** True only for the exact retired production hostname — not preview subdomains. */
export function isRetiredPagesHost(hostname) {
  return hostname === RETIRED_PAGES_HOST;
}

/** Build the new-origin URL preserving path, query and hash. */
export function buildRetiredRedirectUrl(pathname = '/', search = '', hash = '') {
  return NEW_APP_ORIGIN + pathname + search + hash;
}
