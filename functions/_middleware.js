/**
 * Retire paws-pwa.pages.dev with an edge 301, without looping the
 * woodland-restoration.trigrammatic.com custom domain on this same Pages project.
 */
const RETIRED_HOST = 'paws-pwa.pages.dev';
const NEW_ORIGIN = 'https://woodland-restoration.trigrammatic.com';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === RETIRED_HOST) {
    return Response.redirect(NEW_ORIGIN + url.pathname + url.search, 301);
  }
  return context.next();
}
