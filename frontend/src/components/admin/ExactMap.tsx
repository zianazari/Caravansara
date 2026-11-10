"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { mapStyle, osmAttribution } from "@/lib/mapStyle";

/**
 * The listing's exact point, for the admin's review only (constitution, principle V: the admin sees it while
 * reviewing, and the API records each view). Read-only: one pin, zoom controls. The address is written above
 * it as text, so the map is never the only way to know the place.
 */
export function ExactMap({
  latitude,
  longitude,
  loadMap = () => import("maplibre-gl"),
}: {
  latitude: number;
  longitude: number;
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
          center: [longitude, latitude],
          zoom: 15,
          attributionControl: { compact: false },
        });
        map.addControl(new maplibre.NavigationControl({ showCompass: false }));
        const element = document.createElement("span");
        element.className = "arch block h-9 w-7 bg-primary shadow-md";
        element.setAttribute("aria-hidden", "true");
        new maplibre.Marker({ element, anchor: "bottom" }).setLngLat([longitude, latitude]).addTo(map);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  if (failed) {
    return (
      <p role="status" className="rounded-xl border bg-muted p-4 text-sm text-muted-foreground">
        {t("search.mapUnavailable")}
      </p>
    );
  }
  return (
    <section aria-label={t("admin.exactPin")} className="h-72 overflow-hidden rounded-xl border">
      <div ref={box} className="size-full" data-testid="map" />
    </section>
  );
}
