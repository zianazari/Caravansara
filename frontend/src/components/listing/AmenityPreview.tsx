"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { components } from "@/api/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { amenityIcon } from "@/lib/amenityIcons";
import { amenityName } from "@/lib/names";
import { AmenityList } from "./AmenityList";

type Category = components["schemas"]["AmenityCategoryOut"];
const PREVIEW = 10;

/**
 * "What this place offers" (feature 032): the first ten amenities in two columns, and a button that opens
 * all of them, grouped by category, in a dialog. The page stays short and nothing is hidden. The button
 * reads "other amenities" since feature 040 (owner's request), without the count.
 */
export function AmenityPreview({ categories }: { categories: Category[] }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const all = categories.flatMap((c) => c.amenities);
  if (all.length === 0) return <p className="text-muted-foreground">{t("listing.noAmenities")}</p>;
  return (
    <div className="grid justify-items-start gap-6">
      <ul className="grid w-full gap-x-8 gap-y-4 sm:grid-cols-2">
        {all.slice(0, PREVIEW).map((amenity) => {
          const Icon = amenityIcon(amenity);
          return (
            <li key={amenity.id} className="flex items-center gap-4">
              <Icon className="size-6 shrink-0 stroke-[1.5]" aria-hidden />
              <span>{amenityName(t, amenity.name)}</span>
            </li>
          );
        })}
      </ul>
      {all.length > PREVIEW ? (
        <Button variant="outline" size="lg" className="rounded-xl" onClick={() => setOpen(true)}>
          {t("listing.otherAmenities")}
        </Button>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={t("listing.close")} className="max-h-[90dvh] max-w-3xl overflow-y-auto">
          <DialogTitle>{t("listing.offers")}</DialogTitle>
          <AmenityList categories={categories} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
