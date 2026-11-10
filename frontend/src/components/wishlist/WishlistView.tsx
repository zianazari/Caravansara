"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { HeartIcon, StarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { components } from "@/api/schema";
import { api } from "@/api/client";
import { ArchFrame } from "@/components/brand/ArchFrame";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMoney } from "@/hooks/useMoney";
import { useWishlist } from "@/hooks/useWishlist";
import { Link } from "@/i18n/navigation";
import { cityName } from "@/lib/names";
import { HeartButton } from "./HeartButton";

type WishlistPage = components["schemas"]["WishlistPage"];
type Item = components["schemas"]["WishlistItemOut"];
const PAGE = 24;

/**
 * The member's wishlist (feature 012): saved listings, newest first. One that is no longer public stays,
 * marked as unavailable, with a button to remove it, so it never just disappears without a word.
 */
export function WishlistView() {
  const t = useTranslations();
  const list = useInfiniteQuery({
    queryKey: ["me", "wishlist", "page"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<WishlistPage> => {
      const { data, error } = await api.GET("/api/v1/me/wishlist", {
        params: { query: { limit: PAGE, offset: pageParam } },
      });
      if (!data) throw error;
      return data;
    },
    getNextPageParam: (last: WishlistPage, all: WishlistPage[]) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });
  if (!list.data) return <Skeleton className="h-64 w-full" />;
  const items = list.data.pages.flatMap((p) => p.items);
  if (items.length === 0) {
    return (
      <div className="grid justify-items-start gap-3 rounded-2xl border bg-surface p-6">
        <HeartIcon className="size-8 text-primary" aria-hidden />
        <p className="font-semibold">{t("wishlist.emptyTitle")}</p>
        <p className="text-muted-foreground">{t("wishlist.emptyText")}</p>
        <Button asChild className="rounded-full">
          <Link href="/">{t("trips.findPlace")}</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-6">
      <ul className="grid [&>li]:min-w-0 grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {items.map((item) => (
          <li key={item.listing_id}>{item.listing ? <SavedCard item={item} /> : <GoneCard item={item} />}</li>
        ))}
      </ul>
      {list.hasNextPage ? (
        <Button
          variant="outline"
          className="justify-self-start rounded-full"
          onClick={() => list.fetchNextPage()}
          disabled={list.isFetchingNextPage}
        >
          {t("wishlist.more")}
        </Button>
      ) : null}
    </div>
  );
}

function SavedCard({ item }: { item: Item }) {
  const t = useTranslations();
  const locale = useLocale();
  const money = useMoney();
  const l = item.listing!;
  const rating = l.avg_rating
    ? new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en", { maximumFractionDigits: 2 }).format(
        Number(l.avg_rating),
      )
    : null;
  return (
    <article className="relative grid min-w-0 grid-cols-1 gap-1">
      <Link
        href={`/listings/${l.id}`}
        className="group grid min-w-0 grid-cols-1 gap-1 rounded-xl focus-visible:outline-2"
      >
        <ArchFrame
          src={l.cover_url}
          alt={l.cover_url ? "" : t("search.noPhoto")}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="mb-1 aspect-[1/0.96]"
        />
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold">{cityName(t, l.city.name)}</p>
          {rating ? (
            <span
              role="img"
              className="flex shrink-0 items-center gap-1 text-sm"
              aria-label={t("search.rating", { rating, count: l.review_count })}
            >
              <StarIcon className="size-3.5 fill-current" aria-hidden />
              <span aria-hidden>{rating}</span>
            </span>
          ) : null}
        </div>
        <h3 className="line-clamp-1 text-sm text-muted-foreground group-hover:underline">{l.title}</h3>
        <p className="mt-1 break-words">
          <span className="font-extrabold">{money(l.price_per_night, l.currency)}</span>{" "}
          <span className="text-sm text-muted-foreground">{t("search.perNight")}</span>
        </p>
      </Link>
      <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[1/0.96]">
        <HeartButton
          listingId={l.id}
          title={l.title}
          className="pointer-events-auto absolute end-2.5 top-2.5 size-8 sm:end-3 sm:top-3 sm:size-9"
        />
      </div>
    </article>
  );
}

function GoneCard({ item }: { item: Item }) {
  const t = useTranslations("wishlist");
  const { toggle } = useWishlist();
  return (
    <article className="grid gap-2 rounded-2xl border bg-surface p-4">
      <ArchFrame alt="" className="aspect-[1/0.96] w-full opacity-60" />
      <p className="font-semibold">{t("unavailable")}</p>
      <p className="text-sm text-muted-foreground">{t("unavailableText")}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start rounded-full"
        onClick={() => toggle(item.listing_id)}
      >
        {t("removeGone")}
      </Button>
    </article>
  );
}
