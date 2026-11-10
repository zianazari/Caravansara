"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import type { components } from "@/api/schema";
import { ArchFrame } from "@/components/brand/ArchFrame";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Photo = components["schemas"]["PhotoOut"];

/** How far a finger has to travel before it counts as a swipe rather than a tap. */
const SWIPE_PX = 40;

/**
 * Photos in the host's order, the cover first, with room labels; moves with buttons or the arrow keys.
 *
 * Caravansara theme (specs/007-caravansara-theme, FR-007): the photo sits in the lower arch, with a dot for
 * each photo under it, and a phone moves it with a swipe. Swipes use pointer events, so no library is needed;
 * in Persian the next photo comes from the left, so a swipe to the right moves forward, as the arrow keys do.
 */
export function Gallery({ photos, title }: { photos: Photo[]; title: string }) {
  const t = useTranslations("listing");
  const rtl = useLocale() === "fa";
  const [index, setIndex] = useState(0);
  const start = useRef<number | null>(null);
  const sorted = [...photos].sort((a, b) => a.sort_order - b.sort_order);
  const photo = sorted[index];
  if (!photo) {
    return (
      <div className="grid gap-2">
        <ArchFrame alt="" className="aspect-[16/9]" />
        <span className="text-center text-sm text-muted-foreground">{t("photos")}: 0</span>
      </div>
    );
  }
  const go = (by: number) => setIndex((i) => (i + by + sorted.length) % sorted.length);
  const Prev = rtl ? ChevronRightIcon : ChevronLeftIcon;
  const Next = rtl ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("photos")}
      onKeyDown={(event) => {
        if (event.key === (rtl ? "ArrowLeft" : "ArrowRight")) go(1);
        if (event.key === (rtl ? "ArrowRight" : "ArrowLeft")) go(-1);
      }}
      className="grid gap-3"
    >
      <figure
        className="relative touch-pan-y select-none"
        onPointerDown={(event) => {
          start.current = event.clientX;
        }}
        onPointerUp={(event) => {
          const from = start.current;
          start.current = null;
          if (from === null || sorted.length < 2) return;
          const moved = event.clientX - from;
          if (Math.abs(moved) < SWIPE_PX) return;
          go(moved > 0 === rtl ? 1 : -1);
        }}
      >
        <ArchFrame
          src={photo.url}
          alt={photo.caption ?? photo.room_tag ?? title}
          priority={index === 0}
          sizes="(min-width: 1024px) 66vw, 100vw"
          className="aspect-[4/3] md:aspect-[16/9]"
        />
        {photo.room_tag ? (
          <figcaption className="absolute start-3 bottom-3 rounded-full bg-foreground/75 px-3 py-1 text-sm text-background">
            {photo.room_tag}
          </figcaption>
        ) : null}
      </figure>
      {sorted.length > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            aria-label={t("previousPhoto")}
            onClick={() => go(-1)}
          >
            <Prev />
          </Button>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {sorted.map((p, i) => (
              <button
                key={p.id}
                type="button"
                aria-label={t("photo", { index: i + 1, count: sorted.length })}
                aria-current={i === index ? "true" : undefined}
                onClick={() => setIndex(i)}
                className="grid size-6 place-items-center rounded-full"
              >
                <span className={cn("size-2 rounded-full", i === index ? "bg-primary" : "bg-border")} />
              </button>
            ))}
          </div>
          <span className="sr-only" aria-live="polite">
            {t("photo", { index: index + 1, count: sorted.length })}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            aria-label={t("nextPhoto")}
            onClick={() => go(1)}
          >
            <Next />
          </Button>
        </div>
      ) : null}
    </section>
  );
}
