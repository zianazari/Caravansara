"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { UserRoundIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { adminApi } from "@/api/adminClient";
import { PhoneLink } from "@/components/account/PhoneLink";
import { Pager } from "@/components/ui/Pager";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { formatInteger, formatMoney } from "@/lib/money";
import { cityName } from "@/lib/names";
import { lastPage, parsePage } from "@/lib/pageWindow";
import { AdminBookings } from "./AdminBookings";
import { AdminSortHeader } from "./AdminSortHeader";
import { readAdminSort, sortValues } from "./adminSort";
import { AdminRequestError, useAdminGate } from "./useAdminGate";

export function AdminUserDetail({ id }: { id: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const section = useSearchParams().get("section") === "listings" ? "listings" : "bookings";
  const profile = useQuery({
    queryKey: ["admin", "user", id],
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await adminApi.GET("/api/v1/admin/users/{user_id}", {
        params: { path: { user_id: id } },
      });
      if (!data) throw new AdminRequestError(response.status, error);
      return data;
    },
  });
  useAdminGate(profile.error instanceof AdminRequestError ? profile.error.status : undefined);
  const user = profile.data;
  return (
    <div className="grid min-w-0 gap-6" data-admin-workspace>
      <Link href="/admin?tab=users" className="w-fit text-sm text-primary underline underline-offset-4">
        {t("admin.backUsers")}
      </Link>
      {profile.isError ? (
        <p role="alert">
          {t(
            profile.error instanceof AdminRequestError && profile.error.status === 404
              ? "admin.userNotFound"
              : "common.errorText",
          )}
        </p>
      ) : !user ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          <header className="rounded-3xl border bg-card p-5 sm:p-8">
            <div className="flex items-center gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <UserRoundIcon aria-hidden className="size-7" />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{t("admin.userDetail")}</p>
                <h1 className="break-words text-2xl font-bold sm:text-3xl">{user.full_name}</h1>
              </div>
            </div>
            <dl className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="min-w-0">
                <dt className="text-sm text-muted-foreground">{t("admin.colEmail")}</dt>
                <dd className="mt-1 break-all">
                  <a
                    href={`mailto:${user.email}`}
                    dir="ltr"
                    className="text-primary underline underline-offset-4"
                  >
                    {user.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">{t("admin.colPhone")}</dt>
                <dd className="mt-1">
                  <PhoneLink phone={user.phone_number} name={user.full_name} />
                  {!user.phone_number ? t("account.noPhone") : null}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">{t("admin.colKind")}</dt>
                <dd className="mt-1">
                  {t(`admin.kind_${user.kind}`)} ·{" "}
                  {t(user.disabled_at ? "admin.disabled" : "admin.activeAccount")}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">{t("admin.colJoined")}</dt>
                <dd className="mt-1">{formatDate(user.created_at.slice(0, 10), locale, "short")}</dd>
              </div>
            </dl>
          </header>
          <nav aria-label={t("admin.userDetail")} className="flex flex-wrap gap-2">
            {(["bookings", "listings"] as const).map((s) => (
              <Link
                key={s}
                href={`/admin/users/${id}${s === "listings" ? "?section=listings" : ""}`}
                aria-current={section === s ? "page" : undefined}
                className={cn(
                  "rounded-full border px-5 py-2 font-medium transition-colors hover:bg-muted",
                  section === s && "border-primary bg-primary text-primary-foreground hover:bg-primary",
                )}
              >
                {t(s === "bookings" ? "admin.userBookings" : "admin.userListings")}
              </Link>
            ))}
          </nav>
          {section === "bookings" ? <AdminBookings userId={id} /> : <UserListings id={id} />}
        </>
      )}
    </div>
  );
}

const COLUMNS = ["id", "title", "city", "price_per_night", "review_status", "created_at"] as const;
const LABELS = ["colListing", "colName", "colCity", "colTotal", "colStatus", "colMade"] as const;
const PAGE = 20;

function UserListings({ id }: { id: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const params = useSearchParams();
  const page = parsePage(params.get("page"));
  const { sortBy, order } = readAdminSort(params, COLUMNS, "created_at");
  const href = (values: Record<string, string | number | undefined>) =>
    `/admin/users/${id}?${new URLSearchParams({
      section: "listings",
      ...Object.fromEntries(
        Object.entries(values)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ),
    })}`;
  const listings = useQuery({
    queryKey: ["admin", "user-listings", id, page, sortBy, order],
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error, response } = await adminApi.GET("/api/v1/admin/users/{user_id}/listings", {
        params: {
          path: { user_id: id },
          query: { limit: PAGE, offset: (page - 1) * PAGE, sort_by: sortBy, order },
        },
      });
      if (!data) throw new AdminRequestError(response.status, error);
      return data;
    },
  });
  useAdminGate(listings.error instanceof AdminRequestError ? listings.error.status : undefined);
  return (
    <section className="grid min-w-0 gap-4" aria-label={t("admin.userListings")}>
      {listings.isError ? (
        <p role="alert">{t("common.errorText")}</p>
      ) : !listings.data ? (
        <Skeleton className="h-64 w-full" />
      ) : listings.data.items.length === 0 ? (
        <p className="text-muted-foreground">{t("admin.noUserListings")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                {COLUMNS.map((col, i) => (
                  <AdminSortHeader
                    key={col}
                    column={col}
                    label={t(`admin.${LABELS[i]}`)}
                    sortBy={sortBy}
                    order={order}
                    href={href(sortValues(col, sortBy === col && order === "asc" ? "desc" : "asc"))}
                    hint={col === "price_per_night" ? t("admin.sortAmountsHint") : undefined}
                  />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {listings.data.items.map((l) => (
                <tr key={l.id} className="hover:bg-muted/40">
                  <td className="px-3 py-3 tabular-nums">{formatInteger(l.id, locale)}</td>
                  <td className="min-w-44 max-w-64 px-3 py-3">
                    <Link
                      href={`/admin/listings/${l.id}`}
                      className="break-words font-medium text-primary underline underline-offset-4"
                    >
                      {l.title}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">{cityName(t, l.city)}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {formatMoney(l.price_per_night, l.currency, locale, t("common.toman"))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <span className="rounded-full bg-muted px-2 py-1">
                      {t(
                        l.deleted_at
                          ? "admin.archived"
                          : l.review_status === "rejected"
                            ? "host.status_rejected"
                            : l.review_status === "pending"
                              ? "host.status_pending"
                              : l.is_active
                                ? "host.status_active"
                                : "host.status_inactive",
                      )}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                    {formatDate(l.created_at.slice(0, 10), locale, "short")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {listings.data ? (
        <Pager
          page={page}
          last={Math.max(lastPage(listings.data.total, PAGE), 1)}
          hrefFor={(n) => href({ ...sortValues(sortBy, order), page: n })}
        />
      ) : null}
    </section>
  );
}
