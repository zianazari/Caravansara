import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { vi } from "vitest";
import { expectAccessible, renderIn } from "@/test/render";

const GET = vi.fn();
vi.mock("@/api/client", () => ({ api: { GET: (...a: unknown[]) => GET(...a) } }));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

import { LocationPicker, type Point } from "./LocationPicker";

/** MapLibre without WebGL, as in ResultsMap.test: records the view and lets a test drag the pin. */
function fakeMapLibre() {
  const seen: {
    jumps: { center: [number, number]; zoom: number }[];
    pin?: FakeMarker;
    click?: (e: unknown) => void;
  } = { jumps: [] };
  class FakeMap {
    addControl() {}
    remove() {}
    getZoom() {
      return 1;
    }
    jumpTo(view: { center: [number, number]; zoom: number }) {
      seen.jumps.push(view);
    }
    on(_event: string, handler: (e: unknown) => void) {
      seen.click = handler;
    }
  }
  class FakeMarker {
    at: [number, number] | null = null;
    handlers: Record<string, () => void> = {};
    constructor(public options: { element: HTMLElement; draggable: boolean }) {
      seen.pin = this;
    }
    on(event: string, handler: () => void) {
      this.handlers[event] = handler;
      return this;
    }
    setLngLat(at: [number, number]) {
      this.at = at;
      return this;
    }
    getLngLat() {
      return { lng: this.at![0], lat: this.at![1] };
    }
    addTo() {
      return this;
    }
    remove() {
      this.at = null;
    }
  }
  const fake = { Map: FakeMap, Marker: FakeMarker, NavigationControl: class {} };
  return { seen, load: () => Promise.resolve(fake as unknown as typeof import("maplibre-gl")) };
}

function Harness({ cityId, load }: { cityId?: number; load: () => Promise<typeof import("maplibre-gl")> }) {
  const [point, setPoint] = useState<Point>({});
  return (
    <>
      <LocationPicker cityId={cityId} value={point} onChange={setPoint} loadMap={load} />
      <output data-testid="point">{JSON.stringify(point)}</output>
    </>
  );
}

describe("LocationPicker (specs/008-host-pages, R6)", () => {
  beforeEach(() => {
    GET.mockReset();
  });

  it("opens the map on a listing of the chosen city, or far out for a city with none", async () => {
    GET.mockResolvedValue({ data: { items: [{ pin: { lat: 52.37, lng: 4.89 } }], total: 1 } });
    const maplibre = fakeMapLibre();
    const view = renderIn("fa", <Harness cityId={3} load={maplibre.load} />);
    await waitFor(() => expect(maplibre.seen.jumps.at(-1)).toEqual({ center: [4.89, 52.37], zoom: 13 }));
    expect(GET).toHaveBeenCalledWith("/api/v1/search/listings", {
      params: { query: { city_id: 3, limit: 1 } },
    });

    GET.mockResolvedValue({ data: { items: [], total: 0 } });
    view.unmount();
    const far = fakeMapLibre();
    renderIn("fa", <Harness cityId={8} load={far.load} />);
    await waitFor(() => expect(far.seen.jumps.at(-1)).toEqual({ center: [0, 20], zoom: 1 }));
  });

  it("sets the point with a tap or by dragging the pin", async () => {
    GET.mockResolvedValue({ data: { items: [], total: 0 } });
    const maplibre = fakeMapLibre();
    renderIn("fa", <Harness cityId={3} load={maplibre.load} />);
    await waitFor(() => expect(maplibre.seen.click).toBeDefined());
    maplibre.seen.click!({ lngLat: { lat: 35.7, lng: 51.4 } });
    await waitFor(() =>
      expect(screen.getByTestId("point")).toHaveTextContent('{"latitude":35.7,"longitude":51.4}'),
    );
    expect(maplibre.seen.pin!.options.draggable).toBe(true);
    await waitFor(() => expect(maplibre.seen.pin!.at).toEqual([51.4, 35.7]));

    maplibre.seen.pin!.setLngLat([51.41, 35.71]);
    maplibre.seen.pin!.handlers.dragend!();
    await waitFor(() =>
      expect(screen.getByTestId("point")).toHaveTextContent('{"latitude":35.71,"longitude":51.41}'),
    );
  });

  it("works from the keyboard: the number fields move the pin", async () => {
    GET.mockResolvedValue({ data: { items: [], total: 0 } });
    const maplibre = fakeMapLibre();
    renderIn("fa", <Harness cityId={3} load={maplibre.load} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "عرض جغرافیایی" }), {
      target: { value: "35.7" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "طول جغرافیایی" }), {
      target: { value: "51.4" },
    });
    expect(screen.getByTestId("point")).toHaveTextContent('{"latitude":35.7,"longitude":51.4}');
    await waitFor(() => expect(maplibre.seen.pin!.at).toEqual([51.4, 35.7]));
  });

  it("says the guest sees only an approximate place before booking", () => {
    renderIn("fa", <Harness load={fakeMapLibre().load} />);
    expect(screen.getByText(/جای تقریبی/)).toBeInTheDocument();
  });

  it("is accessible", async () => {
    renderIn("fa", <Harness load={fakeMapLibre().load} />);
    await expectAccessible(document.body);
  });
});
