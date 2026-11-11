"use client";

import { HeartIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useWishlist } from "@/hooks/useWishlist";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

/**
 * Save or remove a listing (feature 012). A toggle button with its state (aria-pressed) and the listing's
 * title in its name, so a screen reader says which listing. On a photo it sits on a round card-coloured disc,
 * so it reads on any picture.
 */
export function HeartButton({
  listingId,
  title,
  className,
}: {
  listingId: number;
  title: string;
  className?: string;
}) {
  const t = useTranslations("wishlist");
  const { saved, toggle, ready } = useWishlist();
  const on = saved.has(listingId);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-pressed={on}
      disabled={!ready}
      aria-label={t(on ? "remove" : "save", { title })}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(listingId);
      }}
      className={cn(
        "size-10 rounded-full bg-card/90 shadow-md ring-1 ring-border hover:bg-card disabled:opacity-60 [&_svg]:size-5",
        className,
      )}
    >
      <HeartIcon className={on ? "fill-primary text-primary" : "text-foreground"} aria-hidden />
    </Button>
  );
}
