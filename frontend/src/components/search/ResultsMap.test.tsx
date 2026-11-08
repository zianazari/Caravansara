import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderIn } from "@/test/render";
import { ResultsMap, type MapPin } from "./ResultsMap";

vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

function fakeMapLibre() {
  const added: { element: HTMLElement; at: [number, number] }[] = [];
  class FakeMap {
    constructor(public options: { style: { sources: Record<string, { attribution: string }> } }) {}
    addControl() {}
    remove() {}
    fitBounds = vi.fn();
    getCenter() {
      return { lat: 52.37, lng: 4.89 };
    }
    getBounds() {
      return { getNorth: () => 52.42, getSouth: () => 52.32, getEast: () => 4.95, getWest: () => 4.85 };
    }
  }
  class FakeMarker {
    at: [number, number] = [0, 0];
    constructor(public options: { element: HTMLElement }) {}
    setLngLat(at: [number, number]) {
      this.at = at;
      return this;
    }
    addTo() {
      added.push({ element: this.options.element, at: this.at });
      return this;
    }
    remove() {}
  }
  class FakeBounds {
    extend() {
      return this;
    }
  }
  const fake = { Map: FakeMap, Marker: FakeMarker, LngLatBounds: FakeBounds, NavigationControl: class {} };
  return { added, load: () => Promise.resolve(fake as unknown as typeof import("maplibre-gl")) };
}

const pins: MapPin[] = [
  { id: 1, lat: 52.36, lng: 4.88, label: "€120", href: "/fa/listings/1" },
  { id: 2, lat: 52.38, lng: 4.9, label: "€95", href: "/fa/listings/2" },
];

describe("ResultsMap", () => {
  it("puts one pin per result at the public point the search returned (FR-018)", async () => {
    const maplibre = fakeMapLibre();
    renderIn("fa", <ResultsMap pins={pins} onSearchArea={vi.fn()} loadMap={maplibre.load} />);
    await waitFor(() => expect(maplibre.added).toHaveLength(2));
    expect(maplibre.added.map((m) => m.at)).toEqual([
      [4.88, 52.36],
      [4.9, 52.38],
    ]);
    expect(maplibre.added[0]!.element).toHaveAttribute("href", "/fa/listings/1");
  });

  it("searches the area on screen, within the allowed radius (US1/AC4)", async () => {
    const maplibre = fakeMapLibre();
    const onSearchArea = vi.fn();
    renderIn("en", <ResultsMap pins={pins} onSearchArea={onSearchArea} loadMap={maplibre.load} />);
    await userEvent.click(await screen.findByRole("button", { name: "Search this area" }));
    const area = onSearchArea.mock.calls[0]![0];
    expect(area).toMatchObject({ lat: 52.37, lng: 4.89 });
    expect(area.radius_km).toBeGreaterThanOrEqual(1);
    expect(area.radius_km).toBeLessThanOrEqual(100);
  });

  it("keeps the page working when the map cannot load", async () => {
    renderIn(
      "en",
      <ResultsMap pins={pins} onSearchArea={vi.fn()} loadMap={() => Promise.reject(new Error("blocked"))} />,
    );
    expect(await screen.findByRole("status")).toHaveTextContent("The map did not load");
  });
});
