"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { components } from "@/api/schema";
import { adminApi } from "@/api/adminClient";
import { ArchFrame } from "@/components/brand/ArchFrame";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Pager } from "@/components/ui/Pager";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useRouter } from "@/i18n/navigation";
import { formatDate } from "@/lib/calendar";
import { cityName } from "@/lib/names";
import { lastPage, parsePage } from "@/lib/pageWindow";
import { AdminRequestError, useAdminGate } from "./useAdminGate";

type QueuePage = components["schemas"]["AdminQueuePage"];
type Sort = "oldest" | "newest";
const PAGE = 20;

/** The address of one queue page; the defaults (oldest first, page 1) stay out of it. */
function queueHref(sort: Sort, page: number): string {
  const query = new URLSearchParams();
  if (sort === "newest") query.set("sort", "newest");
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `/admin?${text}` : "/admin";
}

/**
 * The review queue (feature 009): the listings waiting for a decision. Oldest first by default, so the
 * longest wait is decided first; newest first on request (feature 025). Numbered pages replace "more"
 * (feature 025): the page and the order are in the address bar, so reload and the back button keep them.
 * Since feature 051 it is the panel's first tab, with smaller rows so a page needs little scrolling.
 */
export function AdminQueue() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const sortId = useId();
  const params = useSearchParams();
  const sort: Sort = params.get("sort") === "newest" ? "newest" : "oldest";
  const page = parsePage(params.get("page"));
  const queue = useQuery({
    queryKey: ["admin", "queue", sort, page],
    retry: false,
    placeholderData: keepPreviousData, // the old page stays on screen while the next one loads
    queryFn: async (): Promise<QueuePage> => {
      const { data, error, response } = await adminApi.GET("/api/v1/admin/listings/pending", {
        params: { query: { limit: PAGE, offset: (page - 1) * PAGE, sort } },
      });
      if (!data) throw new AdminRequestError(response.status, error);
      return data;
    },
  });
  useAdminGate(queue.error instanceof AdminRequestError ? queue.error.status : undefined);
  const last = queue.data ? lastPage(queue.data.total, PAGE) : undefined;
  // After decisions the queue shrinks; a page past the end moves to the new last page.
  const pastTheEnd = !queue.isPlaceholderData && last !== undefined && page > last;
  useEffect(() => {
    if (pastTheEnd && last !== undefined) router.replace(queueHref(sort, last));
  }, [pastTheEnd, last, sort, router]);

  if (queue.isError) {
    return (
      <p role="alert" className="text-destructive">
        {t("common.errorText")}
      </p>
    );
  }
  if (!queue.data || last === undefined) return <Skeleton className="h-64 w-full" />;
  const { items, total } = queue.data;
  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-lg font-bold">{t("admin.queueTitle")}</h2>
        <p className="text-muted-foreground">{t("admin.queueCount", { count: total })}</p>
        <div className="flex items-center gap-2 sm:ms-auto">
          <Label htmlFor={sortId} className="font-normal">
            {t("admin.sortLabel")}
          </Label>
          <Select value={sort} onValueChange={(value) => router.push(queueHref(value as Sort, 1))}>
            <SelectTrigger id={sortId} className="w-auto min-w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="oldest">{t("admin.sortOldest")}</SelectItem>
              <SelectItem value="newest">{t("admin.sortNewest")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl border bg-surface p-6">{t("admin.queueEmpty")}</p>
      ) : (
        <ul className="grid gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <article className="flex items-center gap-3 rounded-2xl border bg-card p-2 shadow-sm">
                <ArchFrame src={item.cover_url} alt="" sizes="56px" className="h-16 w-12 shrink-0" />
                <div className="grid min-w-0 flex-1 content-start gap-0.5">
                  <h2 className="truncate font-semibold">{item.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {cityName(t, item.city.name)} · {t("admin.hostName", { name: item.host.full_name })}
                  </p>
                  {item.submitted_at ? (
                    <p className="text-xs text-muted-foreground">
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
      <Pager page={Math.min(page, last)} last={last} hrefFor={(n) => queueHref(sort, n)} />
    </div>
  );
}
