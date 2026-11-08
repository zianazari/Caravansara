import { mapTileUrl, mediaBaseUrl, originOf } from "./env";

/** 16 random bytes, base64: a fresh nonce for every page request (research R21). */
export function makeNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * The content security policy of one page response (research R21, contracts/web.md).
 *
 * - script-src: only scripts that carry this request's nonce, and what they load ('strict-dynamic').
 *   Next.js reads the nonce from this header and puts it on its own scripts. 'unsafe-eval' only in
 *   development, where React uses eval for debugging.
 * - style-src 'unsafe-inline': MapLibre and Radix set inline styles on elements; an injected style is far
 *   less dangerous than an injected script.
 * - img-src / connect-src: this site, the photo storage and the map tiles only. A profile picture from any
 *   other server is not loaded (FR-041), so no viewer's address reaches it. connect-src also allows the
 *   storage because the avatar upload posts straight to it (presigned POST).
 * - worker-src blob: MapLibre draws the map in a worker made from a blob.
 */
export function contentSecurityPolicy(nonce: string, isDev: boolean): string {
  const media = originOf(mediaBaseUrl);
  const tiles = originOf(mapTileUrl);
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${media} ${tiles}`,
    `connect-src 'self' ${media} ${tiles}`,
    "worker-src 'self' blob:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
