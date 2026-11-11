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
 * Since 041d (owner's request) it is daytime in the page's own background colour. Since 044 (owner's request)
 * it has no border or shadow, so the scene blends into the page; the opaque band keeps the content scrolling
 * under it out of sight.
 */
export function Hero({ className }: { className?: string }) {
  const t = useTranslations("home");
  return (
    // The sticky part is an opaque band, not the strip itself (feature 044, owner's request: the listings must
    // not show under the animation). The band runs to the screen's edges through the page's side padding
    // (-mx/px match <main>), covers the gap above the strip (-mt-6 pt-6 match main's top padding), and its
    // ::before fills the space behind the see-through header. Without it the rows showed beside the strip, at
    // its rounded corners and through the header while scrolling.
    <div
      className={cn(
        "sticky top-16 z-30 -mx-4 -mt-6 bg-background px-4 pt-6 md:-mx-6 md:px-6 lg:-mx-10 lg:px-10",
        "before:absolute before:inset-x-0 before:bottom-full before:h-16 before:bg-background",
        className,
      )}
    >
      <section
        aria-labelledby="hero-title"
        className="relative h-32 overflow-hidden rounded-3xl bg-background md:h-44"
      >
        <h1 id="hero-title" className="sr-only">
          {t("heroTitle")}
        </h1>
        <HeroJourney />
      </section>
    </div>
  );
}
