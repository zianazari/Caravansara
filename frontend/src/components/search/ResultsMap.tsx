"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { mapStyle, osmAttribution, radiusOfView } from "@/lib/mapStyle";

export type MapPin = { id: number; lat: number; lng: number; label: string; href: string };

/**
 * Results on a map (FR-018): one pin per result, at the public, approximate point the search returns. No other
 * coordinates reach this component. MapLibre is loaded only in the browser; if it fails to load, a short note
 * is shown and the list of results keeps working (Edge Cases). "Search this area" starts a radius search from
 * the map's centre and size (US1/AC4).
 */
export function ResultsMap({
  pins,
  onSearchArea,
  loadMap = () => import("maplibre-gl"),
}: {
  pins: MapPin[];
  onSearchArea: (area: { lat: number; lng: number; radius_km: number }) => void;
  loadMap?: () => Promise<typeof import("maplibre-gl")>;
}) {
  const t = useTranslations();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadMap()
      .then((maplibre) => {
        if (cancelled || !box.current) return;
        const instance = new maplibre.Map({
          container: box.current,
          style: mapStyle(osmAttribution(t("common.mapAttribution"))),
          center: [0, 20],
          zoom: 1,
          attributionControl: { compact: false },
        });
        instance.addControl(new maplibre.NavigationControl({ showCompass: false }));
        map.current = instance;
        setReady(true);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // The map is built once; pins are updated by the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    void loadMap().then((maplibre) => {
      for (const marker of markers.current) marker.remove();
      markers.current = pins.map((pin) => {
        const link = document.createElement("a");
        link.href = pin.href;
        link.textContent = pin.label;
        link.className =
          "rounded-full bg-card px-2 py-1 text-xs font-semibold shadow ring-1 ring-black/10 hover:bg-primary hover:text-primary-foreground";
        return new maplibre.Marker({ element: link }).setLngLat([pin.lng, pin.lat]).addTo(instance);
      });
      if (pins.length > 0) {
        const bounds = new maplibre.LngLatBounds();
        for (const pin of pins) bounds.extend([pin.lng, pin.lat]);
        instance.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0 });
      }
    });
  }, [pins, ready, loadMap]);

  function searchArea() {
    const instance = map.current;
    if (!instance) return;
    const centre = instance.getCenter();
    const b = instance.getBounds();
    onSearchArea({
      lat: centre.lat,
      lng: centre.lng,
      radius_km: radiusOfView({
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      }),
    });
  }

  if (failed) {
    return (
      <p role="status" className="rounded-xl border bg-muted p-4 text-sm text-muted-foreground">
        {t("search.mapUnavailable")}
      </p>
    );
  }
  return (
    <section
      aria-label={t("search.mapLabel")}
      className="relative h-[60vh] min-h-80 overflow-hidden rounded-xl border lg:h-[calc(100dvh-10rem)]"
    >
      <div ref={box} className="size-full" data-testid="map" />
      {ready ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="absolute start-1/2 top-3 shadow ltr:-translate-x-1/2 rtl:translate-x-1/2"
          onClick={searchArea}
        >
          <SearchIcon />
          {t("search.searchThisArea")}
        </Button>
      ) : null}
    </section>
  );
}
