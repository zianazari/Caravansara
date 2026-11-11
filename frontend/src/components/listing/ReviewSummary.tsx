import {
  CheckCircle2Icon,
  KeyRoundIcon,
  MapIcon,
  MessageSquareIcon,
  SparklesIcon,
  TagIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { components } from "@/api/schema";

type Summary = components["schemas"]["ReviewSummary"];

const CATEGORIES = [
  { key: "cleanliness", label: "cleanliness", Icon: SparklesIcon },
  { key: "accuracy", label: "accuracy", Icon: CheckCircle2Icon },
  { key: "check_in", label: "check_in", Icon: KeyRoundIcon },
  { key: "communication", label: "communication", Icon: MessageSquareIcon },
  { key: "location", label: "location_rating", Icon: MapIcon },
  { key: "value", label: "value", Icon: TagIcon },
] as const;

/**
 * The top of the reviews (feature 032): how many guests gave each star, as bars, and the six category
 * averages, each with its line icon, from GET /listings/{id}/reviews/summary over every review, not only the
 * first page. A bar's length is also written as a share, so the chart is never the only way to read it.
 */
export function ReviewSummary({ summary }: { summary: Summary }) {
  const t = useTranslations("listing");
  const locale = useLocale();
  const tag = locale === "fa" ? "fa-IR" : "en";
  const number = (n: number) => new Intl.NumberFormat(tag, { maximumFractionDigits: 1 }).format(n);
  const percent = (n: number) => new Intl.NumberFormat(tag, { style: "percent" }).format(n);
  const rated = CATEGORIES.filter(({ key }) => summary[key] !== null && summary[key] !== undefined);
  return (
    <div className="grid gap-6 border-b pb-8 lg:grid-cols-[minmax(0,1.2fr)_repeat(6,minmax(0,1fr))] lg:gap-0 lg:divide-x lg:rtl:divide-x-reverse">
      <dl aria-label={t("starsChart")} className="grid content-start gap-1.5 lg:pe-6">
        {summary.stars.map(({ stars, count }) => {
          const share = summary.total ? count / summary.total : 0;
          return (
            <div key={stars} className="grid grid-cols-[1.25rem_1fr] items-center gap-2 text-xs">
              <dt>
                <span aria-hidden>{number(stars)}</span>
                <span className="sr-only">{t("starsRow", { stars })}</span>
              </dt>
              <dd className="m-0">
                <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-foreground"
                    style={{ width: `${Math.round(share * 100)}%` }}
                  />
                </span>
                <span className="sr-only">{t("starsShare", { share: percent(share) })}</span>
              </dd>
            </div>
          );
        })}
      </dl>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:contents">
        {rated.map(({ key, label, Icon }) => (
          <li key={key} className="grid content-between gap-6 lg:px-5">
            <span className="grid gap-0.5">
              <span className="text-sm font-semibold">{t(label)}</span>
              <span className="text-lg font-bold">{number(Number(summary[key]))}</span>
            </span>
            <Icon className="size-8 stroke-[1.25]" aria-hidden />
          </li>
        ))}
      </ul>
    </div>
  );
}
