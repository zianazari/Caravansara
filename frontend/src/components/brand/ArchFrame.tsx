"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * A listing photo in its frame. "soft", for every card and photo, is a plain rounded rectangle since feature 017
 * (owner's request: the lower arch of 007 made photos smaller and hid their top corners); "tall" is the
 * caravansara doorway, kept for decoration (an empty page).
 *
 * Without a photo, or when the photo's file cannot be loaded (a missing file in storage), it shows the default
 * listing picture instead of an empty box or a broken image (feature 020, owner's request).
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
          className="object-cover"
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
 * The default listing picture (feature 020): a caravansara's pointed gateway in its courtyard under a sun,
 * drawn here in the theme's colours. No request, no text (it reads the same in both languages), sharp at any
 * size, and never mistaken for a real photo of a place.
 */
export function DefaultListingPhoto({ label, className }: { label?: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      className={cn("size-full", className)}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      data-default-photo
    >
      <rect width="400" height="300" fill="var(--muted)" />
      {/* the sun sits low and inside, clear of the badge and the heart in the top corners */}
      <circle cx="292" cy="100" r="20" fill="var(--gold)" />
      {/* the caravansara's wall with its battlements */}
      <path
        d="M0,150 h30 v-12 h20 v12 h40 v-12 h20 v12 h180 v-12 h20 v12 h40 v-12 h20 v12 h30 V300 H0 Z"
        fill="var(--sand-strong)"
      />
      {/* two small arched windows */}
      <path
        d="M58,240 V205 C58,192 66,185 75,178 C84,185 92,192 92,205 V240 Z"
        fill="var(--copper)"
        opacity="0.55"
      />
      <path
        d="M308,240 V205 C308,192 316,185 325,178 C334,185 342,192 342,205 V240 Z"
        fill="var(--copper)"
        opacity="0.55"
      />
      {/* the pointed gateway: frame, then the doorway in shade */}
      <path d="M128,300 V176 C128,138 166,118 200,88 C234,118 272,138 272,176 V300 Z" fill="var(--copper)" />
      <path
        d="M152,300 V186 C152,160 178,144 200,124 C222,144 248,160 248,186 V300 Z"
        fill="var(--primary)"
      />
      <rect y="276" width="400" height="24" fill="var(--border)" />
    </svg>
  );
}
