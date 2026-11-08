import type { StyleSpecification } from "maplibre-gl";
import { mapTileUrl } from "./env";

/**
 * The map style: one raster layer of OpenStreetMap tiles (research R22). OpenStreetMap publishes no vector
 * style, and raster tiles need no paid key. The tile policy asks for clear attribution with a link to the
 * copyright page, no prefetching and no offline use; this style does neither. Production sets
 * NEXT_PUBLIC_MAP_TILE_URL to another provider.
 */
/** The attribution, in the page's language, always linked to the copyright page (OSM tile policy). */
export function osmAttribution(text: string): string {
  const safe = text.replace(/[<>&"]/g, "");
  return `<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">${safe}</a>`;
}

export const OSM_ATTRIBUTION = osmAttribution("© OpenStreetMap contributors");

export function mapStyle(attribution: string = OSM_ATTRIBUTION): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: { type: "raster", tiles: [mapTileUrl], tileSize: 256, maxzoom: 19, attribution },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  };
}

/** The radius (km) that covers a map view: half its diagonal, kept within the API's 1–100 km (US1/AC4). */
export function radiusOfView(bounds: { north: number; south: number; east: number; west: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const lat1 = toRad(bounds.south);
  const lat2 = toRad(bounds.north);
  const dLat = lat2 - lat1;
  const dLng = toRad(bounds.east - bounds.west);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const diagonal = 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
  return Math.round(Math.min(100, Math.max(1, diagonal / 2)) * 10) / 10;
}
