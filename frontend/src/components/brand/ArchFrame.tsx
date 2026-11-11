"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import defaultPhoto from "@/assets/listing-default.jpg";
import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * A listing photo in its frame. "soft", for every card and photo, is a plain rounded rectangle since feature 017
 * (owner's request: the lower arch of 007 made photos smaller and hid their top corners); "tall" is the
 * caravansara doorway, kept for decoration (an empty page).
 *
 * Without a photo, or when the photo's file cannot be loaded (a missing file in storage), it shows the default
 * listing picture, labelled as a sample, instead of an empty box or a broken image (feature 020, owner's request).
 */
export function ArchFrame({
  src,
  alt,
  variant = "soft",
  sizes,
  priority,
  className,
  children,
}: {
  src?: string | null;
  alt: string;
  variant?: "soft" | "tall";
  sizes?: string;
  priority?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  // A file that failed once is not asked for again while this photo is shown.
  const [failed, setFailed] = useState<string | null>(null);
  const showPhoto = Boolean(src) && failed !== src;
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted",
        variant === "soft" ? "rounded-2xl" : "arch",
        className,
      )}
      data-arch={variant}
    >
      {showPhoto ? (
        <Image
          src={src!}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized
          draggable={false}
          // Feature 031: the photo zooms in a little when its card (a .group) is under the pointer.
          className="object-cover transition-transform duration-700 ease-(--ease-soft) group-hover:scale-[1.06]"
          onError={() => setFailed(src!)}
        />
      ) : (
        <DefaultListingPhoto label={alt} />
      )}
      {children}
    </div>
  );
}

/**
 * The default listing picture (feature 020): a living room photo from the project owner, who owns its rights
 * (confirmed 2026-11-10). A small "sample picture" label sits on it, so a guest never takes it for a photo of
 * the listing itself. The file is bundled with the site (src/assets), so it needs no storage and no request to
 * another service.
 */
export function DefaultListingPhoto({ label, className }: { label?: string; className?: string }) {
  const t = useTranslations("common");
  return (
    <span className={cn("absolute inset-0 block", className)} data-default-photo>
      <Image
        src={defaultPhoto}
        alt={label ?? ""}
        fill
        sizes="(min-width: 1024px) 25vw, 50vw"
        placeholder="empty"
        draggable={false}
        className="object-cover"
      />
      <span className="absolute start-2.5 bottom-2.5 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold text-foreground shadow-sm">
        {t("samplePhoto")}
      </span>
    </span>
  );
}
