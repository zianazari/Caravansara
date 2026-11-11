import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import type { components } from "@/api/schema";
import { serverApi } from "@/api/server";
import { ResultCard } from "@/components/search/ResultCard";
import { SearchControls, SearchFilters } from "@/components/search/SearchControls";
import { CategoryBar } from "@/components/home/CategoryBar";
import { SearchForm } from "@/components/search/SearchForm";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { daysBetween } from "@/lib/calendar";
import { todayInZone } from "@/lib/cityTime";
import { errorCode } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { cityName } from "@/lib/names";
import { PAGE_SIZE, hasArea, parseSearch, stayQuery, toApiQuery, toQuery } from "@/lib/searchParams";

type SearchPageData = components["schemas"]["SearchPage"];

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "search" });
  return { title: t("resultsIn") };
}

/**
 * Search results (US1, FR-016 to FR-020, FR-022): rendered on the server without any token, so search engines
 * and link previews see them, and the first view is fast. The map and the filters run in the browser.
 */
export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const state = parseSearch(await searchParams);
  const today = todayInZone("UTC");

  let page: SearchPageData | null = null;
  let problem: string | null = null;
  if (hasArea(state)) {
    const { data, error } = await serverApi().GET("/api/v1/search/listings", {
      params: { query: toApiQuery(state) },
    });
    if (data) page = data;
    else problem = errorCode(error);
  }

  const nights = state.check_in && state.check_out ? daysBetween(state.check_in, state.check_out) : undefined;
  const stay = stayQuery(state).toString();
  const lang = await getLocale();
  const pins = (page?.items ?? []).map((r) => ({
    id: r.id,
    lat: r.pin.lat,
    lng: r.pin.lng,
    label: formatMoney(r.price_per_night, r.currency, lang, t("common.toman")),
    href: `/${locale}/listings/${r.id}${stay ? `?${stay}` : ""}`,
  }));
  const first = page?.items[0];
  const initialCity =
    state.city_id && first ? { id: state.city_id, label: cityName(t, first.city) } : undefined;
  const pages = page ? Math.max(1, Math.ceil(page.total / PAGE_SIZE)) : 1;
  const current = Math.floor(state.offset / PAGE_SIZE) + 1;
  const pageLink = (offset: number) => `/search?${toQuery({ ...state, offset }).toString()}`;

  return (
    // data-wide: up to 1920 px with small margins, like the home page (feature 017).
    <div className="grid gap-6" data-wide>
      <SearchForm
        today={today}
        initial={state}
        initialCity={initialCity}
        className="mx-auto w-full max-w-4xl"
      />
      {/* specs/007-caravansara-theme, US3: a category sets this search's own filters (research R6). */}
      <Suspense>
        <CategoryBar mode="search" filters={<SearchFilters state={state} />} />
      </Suspense>
      {problem ? (
        <p role="alert" className="rounded-lg border border-destructive p-4 text-destructive">
          {t.has(`errors.${problem}`) ? t(`errors.${problem}`) : t("errors.unknown")}
        </p>
      ) : null}
      {page ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] 2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section aria-labelledby="results-heading" className="grid content-start gap-4">
            <h1 id="results-heading" className="text-xl font-bold" aria-live="polite">
              {t("search.results", { count: page.total })}
            </h1>
            {page.items.length === 0 ? (
              <div className="rounded-xl border bg-surface p-6">
                <h2 className="font-semibold">{t("search.emptyTitle")}</h2>
                <p className="text-muted-foreground">{t("search.emptyHint")}</p>
              </div>
            ) : (
              <ul className="grid [&>li]:min-w-0 grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {page.items.map((result) => (
                  <li key={result.id}>
                    <ResultCard result={result} nights={nights} stay={stay} />
                  </li>
                ))}
              </ul>
            )}
            {pages > 1 ? (
              <nav aria-label={t("search.pagination")} className="flex items-center justify-between gap-2">
                {current > 1 ? (
                  <Button asChild variant="outline">
                    <Link href={pageLink(state.offset - PAGE_SIZE)} rel="prev">
                      {t("common.previous")}
                    </Link>
                  </Button>
                ) : (
                  <span />
                )}
                <span className="text-sm text-muted-foreground">
                  {t("search.page", { page: current, pages })}
                </span>
                {current < pages ? (
                  <Button asChild variant="outline">
                    <Link href={pageLink(state.offset + PAGE_SIZE)} rel="next">
                      {t("common.next")}
                    </Link>
                  </Button>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </section>
          <div className="lg:sticky lg:top-20 lg:self-start">
            <SearchControls state={state} pins={pins} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
