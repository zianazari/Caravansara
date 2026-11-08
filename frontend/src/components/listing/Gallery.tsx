"use client";

import { ChevronLeftIcon, ChevronRightIcon, ImageOffIcon } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { components } from "@/api/schema";
import { Button } from "@/components/ui/button";

type Photo = components["schemas"]["PhotoOut"];

/** Photos in the host's order, the cover first, with room labels; moves with buttons or the arrow keys. */
export function Gallery({ photos, title }: { photos: Photo[]; title: string }) {
  const t = useTranslations("listing");
  const rtl = useLocale() === "fa";
  const [index, setIndex] = useState(0);
  const sorted = [...photos].sort((a, b) => a.sort_order - b.sort_order);
  const photo = sorted[index];
  if (!photo) {
    return (
      <div className="grid aspect-[16/9] place-content-center rounded-xl bg-muted text-muted-foreground">
        <ImageOffIcon className="mx-auto size-8" aria-hidden />
        <span>{t("photos")}: 0</span>
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
      className="grid gap-2"
    >
      <figure className="relative aspect-[16/9] overflow-hidden rounded-xl bg-muted">
        <Image
          src={photo.url}
          alt={photo.caption ?? photo.room_tag ?? title}
          fill
          priority={index === 0}
          sizes="(min-width: 1024px) 66vw, 100vw"
          className="object-cover"
        />
        {photo.room_tag ? (
          <figcaption className="absolute bottom-3 start-3 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
            {photo.room_tag}
          </figcaption>
        ) : null}
      </figure>
      {sorted.length > 1 ? (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="icon" aria-label={t("previousPhoto")} onClick={() => go(-1)}>
            <Prev />
          </Button>
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {t("photo", { index: index + 1, count: sorted.length })}
          </span>
          <Button variant="outline" size="icon" aria-label={t("nextPhoto")} onClick={() => go(1)}>
            <Next />
          </Button>
        </div>
      ) : null}
    </section>
  );
}
