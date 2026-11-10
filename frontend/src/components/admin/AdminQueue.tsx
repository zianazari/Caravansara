"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import type { components } from "@/api/schema";
import { adminApi } from "@/api/adminClient";
import { ArchFrame } from "@/components/brand/ArchFrame";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/calendar";
import { cityName } from "@/lib/names";
import { AdminRequestError, useAdminGate } from "./useAdminGate";

type QueuePage = components["schemas"]["AdminQueuePage"];
const PAGE = 20;

/** The review queue (feature 009): the listings waiting for a decision, oldest first, as the API sorts them. */
export function AdminQueue() {
  const t = useTranslations();
  const locale = useLocale();
  const queue = useInfiniteQuery({
    queryKey: ["admin", "queue"],
    initialPageParam: 0,
    retry: false,
    queryFn: async ({ pageParam }): Promise<QueuePage> => {
      const { data, error, response } = await adminApi.GET("/api/v1/admin/listings/pending", {
        params: { query: { limit: PAGE, offset: pageParam } },
      });
      if (!data) throw new AdminRequestError(response.status, error);
      return data;
    },
    getNextPageParam: (last: QueuePage, all: QueuePage[]) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });
  useAdminGate(queue.error instanceof AdminRequestError ? queue.error.status : undefined);

  if (queue.isError) {
    return (
      <p role="alert" className="text-destructive">
        {t("common.errorText")}
      </p>
    );
  }
  if (!queue.data) return <Skeleton className="h-64 w-full" />;
  const items = queue.data.pages.flatMap((p) => p.items);
  const total = queue.data.pages[0]?.total ?? 0;
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-bold">{t("admin.queueTitle")}</h1>
        <p className="text-muted-foreground">{t("admin.queueCount", { count: total })}</p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl border bg-surface p-6">{t("admin.queueEmpty")}</p>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <article className="flex gap-4 rounded-2xl border bg-card p-3 shadow-sm">
                <ArchFrame src={item.cover_url} alt="" sizes="96px" className="h-24 w-20 shrink-0" />
                <div className="grid min-w-0 flex-1 content-start gap-0.5">
                  <h2 className="truncate font-semibold">{item.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {cityName(t, item.city.name)} · {t("admin.hostName", { name: item.host.full_name })}
                  </p>
                  {item.submitted_at ? (
                    <p className="text-sm text-muted-foreground">
                      {t("admin.submittedAt", { date: formatDate(item.submitted_at.slice(0, 10), locale) })}
                    </p>
                  ) : null}
                </div>
                <Button asChild size="sm" className="self-center rounded-full">
                  <Link
                    href={`/admin/listings/${item.id}`}
                    aria-label={`${t("admin.review")}: ${item.title}`}
                  >
                    {t("admin.review")}
                  </Link>
                </Button>
              </article>
            </li>
          ))}
        </ul>
      )}
      {queue.hasNextPage ? (
        <Button
          variant="outline"
          className="justify-self-start rounded-full"
          onClick={() => queue.fetchNextPage()}
          disabled={queue.isFetchingNextPage}
        >
          {t("admin.more")}
        </Button>
      ) : null}
    </div>
  );
}
