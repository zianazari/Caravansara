"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { components } from "@/api/schema";
import { api } from "@/api/client";
import { ArchFrame } from "@/components/brand/ArchFrame";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { HostListingCard } from "./HostListingCard";

type ListingPage = components["schemas"]["ListingPage"];
const PAGE = 12;

/** "My listings" (specs/008-host-pages, US3): every listing of the user, newest first, a page at a time. */
export function HostListings() {
  const t = useTranslations("host");
  const listings = useInfiniteQuery({
    queryKey: ["me", "listings"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<ListingPage> => {
      const { data, error } = await api.GET("/api/v1/me/listings", {
        params: { query: { limit: PAGE, offset: pageParam } },
      });
      if (!data) throw error;
      return data;
    },
    getNextPageParam: (last: ListingPage, all: ListingPage[]) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });
  if (!listings.data) return <Skeleton className="h-64 w-full" />;
  const all = listings.data.pages.flatMap((p) => p.items);
  if (all.length === 0) {
    return (
      <div className="grid justify-items-center gap-4 rounded-2xl border bg-surface p-8 text-center">
        <ArchFrame alt="" variant="tall" className="h-32 w-24" />
        <h2 className="text-xl font-semibold">{t("emptyTitle")}</h2>
        <p className="max-w-md text-muted-foreground">{t("emptyText")}</p>
        <Button asChild className="rounded-full">
          <Link href="/host/new">{t("createFirst")}</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-6">
      <Button asChild className="justify-self-start rounded-full">
        <Link href="/host/new">
          <PlusIcon aria-hidden />
          {t("newListing")}
        </Link>
      </Button>
      <ul className="grid [&>li]:min-w-0 grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {all.map((listing) => (
          <li key={listing.id}>
            <HostListingCard listing={listing} />
          </li>
        ))}
      </ul>
      {listings.hasNextPage ? (
        <Button
          variant="outline"
          className="justify-self-start rounded-full"
          onClick={() => listings.fetchNextPage()}
          disabled={listings.isFetchingNextPage}
        >
          {t("more")}
        </Button>
      ) : null}
    </div>
  );
}
