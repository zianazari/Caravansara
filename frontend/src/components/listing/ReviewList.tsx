"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { StarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { components } from "@/api/schema";
import { api } from "@/api/client";
import { UserAvatar } from "@/components/account/UserAvatar";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/calendar";

type Review = components["schemas"]["ReviewOut"];
type ReviewPage = components["schemas"]["ReviewPage"];
const PAGE = 10;
const SUB = ["cleanliness", "accuracy", "check_in", "communication", "location", "value"] as const;

/**
 * Reviews of a listing (FR-021): the first page comes from the server render, more load on request from
 * GET /listings/{id}/reviews. Each review shows the six detailed ratings, the author and the date.
 */
export function ReviewList({ listingId, first }: { listingId: number; first: ReviewPage }) {
  const t = useTranslations("listing");
  const reviews = useInfiniteQuery({
    queryKey: ["reviews", listingId],
    initialPageParam: 0,
    initialData: { pages: [first], pageParams: [0] },
    getNextPageParam: (_last, all) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0);
      return loaded < first.total ? loaded : undefined;
    },
    queryFn: async ({ pageParam }) => {
      const { data } = await api.GET("/api/v1/listings/{listing_id}/reviews", {
        params: { path: { listing_id: listingId }, query: { limit: PAGE, offset: pageParam } },
      });
      return data ?? { items: [], total: first.total };
    },
  });
  const items = reviews.data.pages.flatMap((p) => p.items);
  if (items.length === 0) return <p className="text-muted-foreground">{t("noReviews")}</p>;
  return (
    <div className="grid gap-6">
      <ul className="grid gap-6 sm:grid-cols-2">
        {items.map((review) => (
          <li key={review.id}>
            <ReviewItem review={review} />
          </li>
        ))}
      </ul>
      {reviews.hasNextPage ? (
        <Button
          variant="outline"
          className="justify-self-start"
          disabled={reviews.isFetchingNextPage}
          onClick={() => reviews.fetchNextPage()}
        >
          {t("moreReviews")}
        </Button>
      ) : null}
    </div>
  );
}

function ReviewItem({ review }: { review: Review }) {
  const t = useTranslations("listing");
  const locale = useLocale();
  const n = (x: number) => new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en").format(x);
  const subs = SUB.map((key) => [key, review[`${key}_rating`]] as const).filter(
    ([, v]) => v !== null && v !== undefined,
  );
  return (
    <article className="grid gap-2">
      <header className="flex items-center gap-3">
        <UserAvatar user={review.author} size="sm" />
        <div>
          <p className="font-medium">{review.author.full_name}</p>
          <p className="text-sm text-muted-foreground">
            {formatDate(review.created_at.slice(0, 10), locale)}
          </p>
        </div>
        <span
          role="img"
          className="ms-auto flex items-center gap-1"
          aria-label={`${n(review.rating)}/${n(5)}`}
        >
          <StarIcon className="size-4 fill-current" aria-hidden />
          <span aria-hidden>{n(review.rating)}</span>
        </span>
      </header>
      <p className="whitespace-pre-line">{review.comment}</p>
      {subs.length ? (
        <dl aria-label={t("subRatings")} className="grid grid-cols-2 gap-x-4 text-sm text-muted-foreground">
          {subs.map(([key, value]) => (
            <div key={key} className="flex justify-between">
              <dt>{t(key === "location" ? "location_rating" : key)}</dt>
              <dd>{n(value as number)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}
