"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { mapStyle, osmAttribution } from "@/lib/mapStyle";

/**
 * "Where it is" (feature 032): the listing's public, approximate point on a map, drawn as a soft circle
 * rather than a pin, because the API moves the public point away from the real address on purpose (FR-018).
 * The text above the map says the same, so the map is never the only way to know it.
 */
export function AreaMap({
  lat,
  lng,
  loadMap = () => import("maplibre-gl"),
}: {
  lat: number;
  lng: number;
  loadMap?: () => Promise<typeof import("maplibre-gl")>;
}) {
  const t = useTranslations();
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let map: import("maplibre-gl").Map | undefined;
    let cancelled = false;
    loadMap()
      .then((maplibre) => {
        if (cancelled || !box.current) return;
        map = new maplibre.Map({
          container: box.current,
          style: mapStyle(osmAttribution(t("common.mapAttribution"))),
          center: [lng, lat],
          zoom: 13.5,
          cooperativeGestures: true,
          attributionControl: { compact: false },
        });
        map.addControl(new maplibre.NavigationControl({ showCompass: false }));
        const element = document.createElement("span");
        element.className = "block size-28 rounded-full border-2 border-primary bg-primary/20";
        element.setAttribute("aria-hidden", "true");
        new maplibre.Marker({ element }).setLngLat([lng, lat]).addTo(map);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      map?.remove();
    };
    // The map is built once per point; a new t or loadMap function must not rebuild it (as in ExactMap).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  if (failed) {
    return (
      <p role="status" className="rounded-xl border bg-muted p-4 text-sm text-muted-foreground">
        {t("search.mapUnavailable")}
      </p>
    );
  }
  return (
    <div aria-label={t("listing.areaMap")} role="region" className="h-96 overflow-hidden rounded-2xl border">
      <div ref={box} className="size-full" data-testid="area-map" />
    </div>
  );
}
