"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { api } from "@/api/client";
import { Gallery } from "@/components/listing/Gallery";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";

/**
 * The booked place on a trip's page (feature 022, owner's request): its photos in the listing page's gallery
 * and a link back to the listing. Read with the guest's session, so a guest with a live booking still sees a
 * listing the host has taken out of search (the API's rule, FR-019); a listing that is no longer shown gets a
 * short note instead of an error.
 */
export function TripListing({ listingId, title }: { listingId: number; title: string }) {
  const t = useTranslations("trips");
  const listing = useQuery({
    queryKey: ["trip-listing", listingId],
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/listings/{listing_id}", {
        params: { path: { listing_id: listingId } },
      });
      return data ?? null;
    },
  });
  if (listing.isPending) return <Skeleton className="aspect-[2.25/1] w-full rounded-2xl" />;
  if (!listing.data) return <p className="text-sm text-muted-foreground">{t("listingGone")}</p>;
  return (
    <section aria-label={t("thePlace")} className="grid gap-3">
      <Gallery photos={listing.data.photos} title={title} />
      <Button asChild variant="outline" className="justify-self-start rounded-full">
        <Link href={`/listings/${listingId}`}>
          <ExternalLinkIcon aria-hidden />
          {t("viewListing")}
        </Link>
      </Button>
    </section>
  );
}
