/**
 * Public settings. NEXT_PUBLIC_* values are built into the browser code, so none of them may be a secret
 * (contracts/web.md). Each one is read by its literal name, because Next.js only replaces literal names.
 */
export const mediaBaseUrl = (
  process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "http://localhost:9000/caravansara-media"
).replace(/\/+$/, "");

/** Raster tiles for the map; OpenStreetMap by default, another provider in production (research R22). */
export const mapTileUrl =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/** The origin (scheme://host:port) of a URL or URL template, for the content security policy. */
export function originOf(url: string): string {
  return new URL(url.replace(/\{[a-z]\}/g, "0")).origin;
}
