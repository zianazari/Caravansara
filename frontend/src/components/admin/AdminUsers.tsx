"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { components } from "@/api/schema";
import { adminApi } from "@/api/adminClient";
import { Input } from "@/components/ui/input";
import { Pager } from "@/components/ui/Pager";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "@/i18n/navigation";
import { formatDate } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { lastPage, parsePage } from "@/lib/pageWindow";
import { adminHref } from "./adminHref";
import { AdminRequestError, useAdminGate } from "./useAdminGate";

type UserPage = components["schemas"]["AdminUserPage"];
const PAGE = 20;
const MIN_SEARCH = 3; // the API's least: a trigram needs 3 letters (migration 0011)

/**
 * Every account, newest first, with a search on any part of a name or an email (feature 051). The search goes
 * into the address bar a moment after typing stops, so each letter does not make a request.
 */
export function AdminUsers() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const searchId = useId();
  const hintId = useId();
  const params = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const page = parsePage(params.get("page"));
  const [text, setText] = useState(q);
  const typed = text.trim();
  const tooShort = typed.length > 0 && typed.length < MIN_SEARCH;

  useEffect(() => {
    if (tooShort || typed === q) return;
    const timer = setTimeout(() => router.replace(adminHref("users", { q: typed })), 350);
    return () => clearTimeout(timer);
  }, [typed, q, tooShort, router]);

  const list = useQuery({
    queryKey: ["admin", "users", q, page],
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<UserPage> => {
      const { data, error, response } = await adminApi.GET("/api/v1/admin/users", {
        params: { query: { limit: PAGE, offset: (page - 1) * PAGE, ...(q ? { q } : {}) } },
      });
      if (!data) throw new AdminRequestError(response.status, error);
      return data;
    },
  });
  useAdminGate(list.error instanceof AdminRequestError ? list.error.status : undefined);
  const day = (iso: string) => formatDate(iso.slice(0, 10), locale, "short");

  return (
    <div className="grid min-w-0 gap-4">
      <h2 className="sr-only">{t("admin.usersTitle")}</h2>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-80">
          <label htmlFor={searchId} className="sr-only">
            {t("admin.usersSearch")}
          </label>
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={searchId}
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("admin.usersSearch")}
            aria-describedby={tooShort ? hintId : undefined}
            className="ps-9"
          />
        </div>
        {tooShort ? (
          <p id={hintId} className="text-sm text-muted-foreground">
            {t("admin.usersSearchHint")}
          </p>
        ) : list.data ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t("admin.usersCount", { count: list.data.total })}
          </p>
        ) : null}
      </div>
      {list.isError ? (
        <p role="alert" className="text-destructive">
          {t("common.errorText")}
        </p>
      ) : !list.data ? (
        <Skeleton className="h-96 w-full" />
      ) : list.data.items.length === 0 ? null : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-start font-medium">{t("admin.colName")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("admin.colEmail")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("admin.colKind")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("admin.colJoined")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.data.items.map((u) => (
                <tr key={u.id} className="hover:bg-muted/40">
                  <td className="max-w-56 truncate px-3 py-2 font-medium">{u.full_name}</td>
                  <td className="max-w-72 truncate px-3 py-2" dir="ltr">
                    {u.email}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-xs font-semibold",
                        u.kind === "admin"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground",
                      )}
                    >
                      {t(`admin.kind_${u.kind}`)}
                    </span>
                    {u.disabled_at ? (
                      <span className="ms-2 text-xs text-destructive">{t("admin.disabled")}</span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{day(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.data ? (
        <Pager
          page={page}
          last={Math.max(lastPage(list.data.total, PAGE), 1)}
          hrefFor={(n) => adminHref("users", { q: q || undefined, page: n })}
        />
      ) : null}
    </div>
  );
}
