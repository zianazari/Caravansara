import { OSM_ATTRIBUTION, mapStyle, osmAttribution, radiusOfView } from "./mapStyle";

describe("map style (research R22)", () => {
  it("uses raster OpenStreetMap tiles with attribution linked to the copyright page", () => {
    const style = mapStyle();
    const source = style.sources.osm as { type: string; tiles: string[]; attribution: string };
    expect(source.type).toBe("raster");
    expect(source.tiles).toEqual(["https://tile.openstreetmap.org/{z}/{x}/{y}.png"]);
    expect(source.attribution).toBe(OSM_ATTRIBUTION);
    expect(OSM_ATTRIBUTION).toContain("https://www.openstreetmap.org/copyright");
    expect(osmAttribution("© مشارکت‌کنندگان <b>OSM</b>")).toBe(
      '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© مشارکت‌کنندگان bOSM/b</a>',
    );
  });

  it("turns a map view into a radius within 1–100 km", () => {
    // about 11 km × 7 km around Amsterdam: radius about half the diagonal
    const r = radiusOfView({ north: 52.42, south: 52.32, east: 4.95, west: 4.85 });
    expect(r).toBeGreaterThan(5);
    expect(r).toBeLessThan(8);
    expect(radiusOfView({ north: 52.3701, south: 52.37, east: 4.8901, west: 4.89 })).toBe(1);
    expect(radiusOfView({ north: 60, south: 40, east: 20, west: -10 })).toBe(100);
  });
});
