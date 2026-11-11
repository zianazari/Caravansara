"use client";

import { useTranslations } from "next-intl";
import type { components } from "@/api/schema";
import { ArchFrame } from "@/components/brand/ArchFrame";
import { Button } from "@/components/ui/button";
import { useMoney } from "@/hooks/useMoney";
import { Link } from "@/i18n/navigation";
import { MIN_PHOTOS, statusOf } from "@/lib/listingStatus";
import { cityName } from "@/lib/names";
import { FewPhotosBadge, StatusBadge } from "./StatusBadge";

type Summary = components["schemas"]["ListingSummary"];

/**
 * One of the host's listings (specs/008-host-pages, US3/AC1): the cover in the lower arch, title, city, nightly
 * price and status. Since feature 015 the list's summary has the photo count, so the card says when photos are
 * missing (FR-016), with a link straight to the photos tab, without reading each listing.
 */
export function HostListingCard({ listing }: { listing: Summary }) {
  const t = useTranslations();
  const money = useMoney();
  const few = (listing.photo_count ?? 0) < MIN_PHOTOS;
  const href = `/host/listings/${listing.id}`;
  return (
    <article className="grid min-w-0 grid-cols-1 gap-3">
      <Link href={href} className="group rounded-2xl" aria-label={listing.title}>
        <ArchFrame
          src={listing.cover_url}
          alt=""
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="aspect-[1/0.96] w-full transition-[transform,box-shadow] duration-300 ease-(--ease-soft) group-hover:-translate-y-1 group-hover:shadow-[0_18px_32px_-18px_color-mix(in_srgb,var(--foreground)_45%,transparent)]"
        />
      </Link>
      <div className="grid min-w-0 gap-1">
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge status={statusOf({ ...listing, photos: [] })} />
          {few ? <FewPhotosBadge /> : null}
        </div>
        <Link href={href} className="truncate font-semibold transition-colors hover:text-primary">
          {listing.title}
        </Link>
        <p className="text-sm text-muted-foreground">{cityName(t, listing.city.name)}</p>
        <p className="text-sm">{money(listing.price_per_night, listing.currency)}</p>
        {few ? (
          <Button asChild variant="soft" size="sm" className="justify-self-start">
            <Link href={`${href}?tab=photos`}>{t("host.completePhotos")}</Link>
          </Button>
        ) : null}
      </div>
    </article>
  );
}
