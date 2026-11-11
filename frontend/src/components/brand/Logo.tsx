import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/**
 * The site's mark (feature 027, owner's choice "ب"): two nested pointed arches drawn as lines on a base
 * line, after the first logo of the home-page mockup, whose arches were round. The outer arch is the
 * caravansara's gateway and the inner one its door. Lines rather than a filled shape keep it light next to
 * the name. The favicon (src/app/icon.svg) is the same drawing.
 *
 * `onDark` is for the admin panel's night-blue header: gold and amber there, copper and amber on the light
 * header, the same pairs as the first logo and the hero.
 */
export function Logo({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  const t = useTranslations("common");
  const outer = onDark ? "stroke-gold" : "stroke-copper";
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-xl font-extrabold",
        onDark ? "text-gold" : "text-primary",
        className,
      )}
    >
      <svg
        aria-hidden
        data-logo="arches"
        viewBox="0 0 40 44"
        fill="none"
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-8 w-7 shrink-0"
      >
        <path d="M6 42V21C6 13.5 11.8 8.4 20 4C28.2 8.4 34 13.5 34 21V42" className={outer} />
        <path
          d="M14 42V26.08C14 20.4 16.49 16.53 20 13.2C23.51 16.53 26 20.4 26 26.08V42"
          className="stroke-amber"
        />
        <path d="M2 42h36" className={outer} />
      </svg>
      {t("siteName")}
    </span>
  );
}
