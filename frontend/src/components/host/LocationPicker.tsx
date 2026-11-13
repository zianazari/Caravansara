"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useQuery } from "@tanstack/react-query";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { api } from "@/api/client";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createHouseMarker } from "@/lib/mapMarker";
import { mapStyle, osmAttribution } from "@/lib/mapStyle";

export type Point = { latitude?: number; longitude?: number };

/**
 * The listing's exact place (specs/008-host-pages, research R6). The API needs the real latitude and longitude;
 * guests only ever see a point moved 100 to 500 m from it until they have booked. The map opens on a listing of
 * the chosen city (the API has no city coordinates, and a geocoding service would send the host's address
 * outside, principle V); for a city with no listing yet it opens on the whole map. The host taps or drags the
 * pin; the two number fields do the same from the keyboard, so the map is never the only way.
 */
export function LocationPicker({
  cityId,
  value,
  onChange,
  error,
  loadMap = () => import("maplibre-gl"),
}: {
  cityId?: number;
  value: Point;
  onChange: (point: { latitude: number; longitude: number }) => void;
  error?: string;
  loadMap?: () => Promise<typeof import("maplibre-gl")>;
}) {
  const t = useTranslations();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const change = useRef(onChange);
  useEffect(() => {
    change.current = onChange;
  }, [onChange]);

  const centre = useQuery({
    queryKey: ["city-centre", cityId],
    enabled: cityId !== undefined,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/search/listings", {
        params: { query: { city_id: cityId, limit: 1 } },
      });
      return data?.items[0]?.pin ?? null;
    },
  });

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
        // The shared house marker is decorative: the number fields below
        // are the accessible way to set the same point.
        const element = createHouseMarker({ draggable: true });
        const pin = new maplibre.Marker({ element, draggable: true, anchor: "bottom" });
        pin.on("dragend", () => {
          const at = pin.getLngLat();
          change.current({ latitude: round(at.lat), longitude: round(at.lng) });
        });
        instance.on("click", (event) =>
          change.current({ latitude: round(event.lngLat.lat), longitude: round(event.lngLat.lng) }),
        );
        map.current = instance;
        marker.current = pin;
        setReady(true);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // The map is built once; the pin and the view follow the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { latitude, longitude } = value;
  const placed = latitude !== undefined && longitude !== undefined;

  // The pin follows the value, whether it came from the map or from the number fields.
  useEffect(() => {
    if (!ready || !map.current || !marker.current) return;
    if (placed) marker.current.setLngLat([longitude, latitude]).addTo(map.current);
    else marker.current.remove();
  }, [ready, placed, latitude, longitude]);

  // A new city moves the view to it, unless the pin is already there.
  const pinCentre = centre.data;
  useEffect(() => {
    if (!ready || !map.current || cityId === undefined || centre.isPending) return;
    if (placed) {
      map.current.jumpTo({ center: [longitude, latitude], zoom: Math.max(map.current.getZoom(), 13) });
    } else if (pinCentre) {
      map.current.jumpTo({ center: [pinCentre.lng, pinCentre.lat], zoom: 13 });
    } else {
      map.current.jumpTo({ center: [0, 20], zoom: 1 });
    }
    // Only when the city or its centre changes, not on every move of the pin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, cityId, pinCentre, centre.isPending]);

  function setNumber(field: "latitude" | "longitude", text: string) {
    const number = Number(text);
    if (text.trim() === "" || !Number.isFinite(number)) return;
    const other = field === "latitude" ? longitude : latitude;
    const fallback = field === "latitude" ? (pinCentre?.lng ?? 0) : (pinCentre?.lat ?? 0);
    onChange(
      field === "latitude"
        ? { latitude: number, longitude: other ?? fallback }
        : { latitude: other ?? fallback, longitude: number },
    );
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">{t("wizard.mapHint")}</p>
      {failed ? (
        <p role="status" className="rounded-xl border bg-muted p-4 text-sm text-muted-foreground">
          {t("search.mapUnavailable")}
        </p>
      ) : (
        <section
          aria-label={t("wizard.mapLabel")}
          className="h-72 min-h-[250px] overflow-hidden rounded-xl border"
        >
          <div ref={box} className="size-full" data-testid="map" />
        </section>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("wizard.latitude")} error={error}>
          {(props) => (
            <Input
              {...props}
              type="number"
              step="any"
              min={-90}
              max={90}
              dir="ltr"
              value={latitude ?? ""}
              onChange={(event) => setNumber("latitude", event.target.value)}
            />
          )}
        </Field>
        <Field label={t("wizard.longitude")}>
          {(props) => (
            <Input
              {...props}
              type="number"
              step="any"
              min={-180}
              max={180}
              dir="ltr"
              value={longitude ?? ""}
              onChange={(event) => setNumber("longitude", event.target.value)}
            />
          )}
        </Field>
      </div>
      <p className="text-sm text-muted-foreground">{t("wizard.addressHint")}</p>
    </div>
  );
}

/** Six decimals: about 10 cm, more than a pin on a phone can mean. */
function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
