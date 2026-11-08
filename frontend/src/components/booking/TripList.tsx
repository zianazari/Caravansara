"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { ImageOffIcon } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { components } from "@/api/schema";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMoney } from "@/hooks/useMoney";
import { Link } from "@/i18n/navigation";
import { canReview, group } from "@/lib/bookingView";
import { formatDate } from "@/lib/calendar";
import { cityName } from "@/lib/names";
import { reviewedKey } from "./ReviewForm";

type Booking = components["schemas"]["BookingOut"];
type BookingPage = components["schemas"]["BookingPage"];
const PAGE = 20;

/** Every booking of the user, upcoming first and then past (FR-029, US4/AC1, AC5). */
export function TripList() {
  const t = useTranslations();
  const trips = useInfiniteQuery({
    queryKey: ["trips"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<BookingPage> => {
      const { data, error } = await api.GET("/api/v1/me/bookings", {
        params: { query: { limit: PAGE, offset: pageParam } },
      });
      if (!data) throw error;
      return data;
    },
    getNextPageParam: (last: BookingPage, all: BookingPage[]) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });
  if (!trips.data) return <Skeleton className="h-48 w-full" />;
  const all = trips.data.pages.flatMap((p) => p.items);
  if (all.length === 0) {
    return (
      <div className="grid justify-items-start gap-3 rounded-xl border bg-muted p-6">
        <p>{t("trips.empty")}</p>
        <Button asChild>
          <Link href="/">{t("trips.findPlace")}</Link>
        </Button>
      </div>
    );
  }
  const upcoming = all.filter((b) => group(b) === "upcoming");
  const past = all.filter((b) => group(b) === "past");
  return (
    <div className="grid gap-8">
      {[
        ["upcoming", upcoming],
        ["past", past],
      ].map(([key, items]) =>
        (items as Booking[]).length ? (
          <section key={key as string} aria-labelledby={`trips-${key}`} className="grid gap-3">
            <h2 id={`trips-${key}`} className="text-lg font-semibold">
              {t(`trips.${key as "upcoming"}`)}
            </h2>
            <ul className="grid gap-3">
              {(items as Booking[]).map((b) => (
                <li key={b.id}>
                  <TripRow booking={b} />
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
      {trips.hasNextPage ? (
        <Button
          variant="outline"
          className="justify-self-start"
          onClick={() => trips.fetchNextPage()}
          disabled={trips.isFetchingNextPage}
        >
          {t("trips.more")}
        </Button>
      ) : null}
    </div>
  );
}

function TripRow({ booking: b }: { booking: Booking }) {
  const t = useTranslations();
  const reviewed = useQueryClient().getQueryData(reviewedKey(b.id)) === true;
  const locale = useLocale();
  const money = useMoney();
  return (
    <article className="flex gap-3 rounded-xl border bg-card p-3">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
        {b.listing.cover_url ? (
          <Image src={b.listing.cover_url} alt="" fill sizes="80px" className="object-cover" />
        ) : (
          <ImageOffIcon className="m-auto size-6 h-full text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <Link href={`/trips/${b.id}`} className="truncate font-semibold hover:underline">
          {b.listing.title}
        </Link>
        <p className="text-sm text-muted-foreground">
          {cityName(t, b.listing.city)} · {formatDate(b.check_in, locale)} – {formatDate(b.check_out, locale)}
        </p>
        <p className="text-sm">
          <span className="font-medium">{t(`booking.status_${b.status}`)}</span> ·{" "}
          {money(b.total_price, b.currency)}
        </p>
        {canReview(b) && !reviewed ? (
          <Link href={`/trips/${b.id}/review`} className="text-sm font-medium text-primary underline">
            {t("trips.review")}
          </Link>
        ) : null}
      </div>
    </article>
  );
}
