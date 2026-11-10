"use client";

import { useTranslations } from "next-intl";
import { MIN_PHOTOS } from "@/lib/listingStatus";
import { DraftPhotos, type DraftPhoto } from "../PhotoManager";

/**
 * Step 8: photos, chosen and checked in the page (lib/imageCheck, inside the picker) and sent only when the
 * listing is created (research R3). At least three (Q1).
 */
export function PhotosStep({
  items,
  onItems,
  onRetry,
}: {
  items: DraftPhoto[];
  onItems: (items: DraftPhoto[]) => void;
  onRetry?: () => void;
}) {
  const t = useTranslations("photos");
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      <DraftPhotos items={items} onItems={onItems} onRetry={onRetry} />
      {items.length < MIN_PHOTOS ? <p className="text-sm font-medium">{t("minNeeded")}</p> : null}
    </div>
  );
}
