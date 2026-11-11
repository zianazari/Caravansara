import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { HeroJourney } from "./HeroJourney";

/**
 * The home page's welcome (specs/007-caravansara-theme, FR-009). Since feature 041 it is the car's story
 * (HeroJourney), and since 041c (owner's requests) a short strip with no visible text, pinned under the
 * header for the whole page, so the story is always in view while the car drives with the scroll.
 *
 * The title stays only for screen readers and search engines (sr-only): a page needs its main heading, and
 * "no text" was about what is seen. The strip sits above the search pill (z-30), which scrolls under it.
 * Since 041d (owner's request) it is daytime in the page's own background colour; a thin border and a soft
 * shadow keep it apart from the content scrolling under it.
 */
export function Hero({ className }: { className?: string }) {
  const t = useTranslations("home");
  return (
    <section
      aria-labelledby="hero-title"
      className={cn(
        "sticky top-16 z-30 h-32 overflow-hidden rounded-3xl border bg-background shadow-lg shadow-foreground/10 md:h-44",
        className,
      )}
    >
      <h1 id="hero-title" className="sr-only">
        {t("heroTitle")}
      </h1>
      <HeroJourney />
    </section>
  );
}
