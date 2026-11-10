"use client";

import { ChevronLeftIcon, ChevronRightIcon, LayoutGridIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import type { components } from "@/api/schema";
import { ArchFrame, DefaultListingPhoto } from "@/components/brand/ArchFrame";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Photo = components["schemas"]["PhotoOut"];

/** How far a finger has to travel before it counts as a swipe rather than a tap. */
const SWIPE_PX = 40;

/**
 * On a phone (feature 021): one photo at a time, the cover first, with room labels; moves with buttons, the
 * arrow keys or a swipe, with a dot for each photo under it (specs/007-caravansara-theme, FR-007). Swipes use pointer events, so no library is needed;
 * in Persian the next photo comes from the left, so a swipe to the right moves forward, as the arrow keys do.
 */
function Carousel({ photos, title }: { photos: Photo[]; title: string }) {
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

/** How many photos the mosaic shows: one large and four small (feature 021, owner's reference picture). */
const MOSAIC = 5;

/**
 * The listing's photos (feature 021, owner's request with a reference picture). From 768 px a mosaic: the
 * cover large on one side and the next four in a 2×2 grid, in one rounded block, with "show all photos" in its
 * corner; any photo opens all of them in a dialog at that photo. A listing has at least 5 photos (MIN_PHOTOS);
 * an older one with fewer fills the empty tiles with the sample picture, so the layout never breaks. A phone
 * keeps the swipe carousel, since the mosaic would be too small there.
 */
export function Gallery({ photos, title }: { photos: Photo[]; title: string }) {
  const t = useTranslations("listing");
  const sorted = [...photos].sort((a, b) => a.sort_order - b.sort_order);
  const [open, setOpen] = useState<number | null>(null);
  const tiles = Array.from({ length: MOSAIC }, (_, i) => sorted[i]);
  return (
    <>
      <div className="md:hidden">
        <Carousel photos={sorted} title={title} />
      </div>
      <section aria-label={t("photos")} className="relative hidden md:block">
        <div className="grid aspect-[2.25/1] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl">
          {tiles.map((photo, i) => (
            <div
              key={photo?.id ?? `empty-${i}`}
              className={cn("relative min-h-0", i === 0 && "col-span-2 row-span-2")}
            >
              {photo ? (
                <button
                  type="button"
                  onClick={() => setOpen(i)}
                  aria-label={`${t("photo", { index: i + 1, count: sorted.length })}: ${photo.caption ?? photo.room_tag ?? title}`}
                  className="group block size-full focus-visible:outline-2 focus-visible:-outline-offset-4"
                >
                  <ArchFrame
                    src={photo.url}
                    alt=""
                    priority={i === 0}
                    sizes={i === 0 ? "50vw" : "25vw"}
                    className="size-full rounded-none transition-[filter] group-hover:brightness-90"
                  />
                </button>
              ) : (
                <DefaultListingPhoto />
              )}
            </div>
          ))}
        </div>
        {sorted.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen(0)}
            className="absolute end-4 bottom-4 flex items-center gap-2 rounded-lg border border-foreground/20 bg-card px-3 py-1.5 text-sm font-semibold shadow-sm hover:bg-muted"
          >
            <LayoutGridIcon className="size-4" aria-hidden />
            {t("showAllPhotos", { count: sorted.length })}
          </button>
        ) : null}
      </section>
      <Dialog open={open !== null} onOpenChange={(next) => (next ? undefined : setOpen(null))}>
        <DialogContent closeLabel={t("close")} className="max-h-[90dvh] max-w-4xl overflow-y-auto">
          <DialogTitle>{t("allPhotos", { count: sorted.length })}</DialogTitle>
          <ul className="grid gap-4">
            {sorted.map((photo, i) => (
              <li
                key={photo.id}
                ref={(el) => {
                  if (el && i === open) el.scrollIntoView?.({ block: "start" });
                }}
                className="grid gap-1"
              >
                <ArchFrame
                  src={photo.url}
                  alt={photo.caption ?? photo.room_tag ?? title}
                  sizes="(min-width: 896px) 896px, 100vw"
                  className="aspect-[3/2] w-full"
                />
                {photo.room_tag || photo.caption ? (
                  <p className="text-sm text-muted-foreground">
                    {[photo.room_tag, photo.caption].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
