import { useTranslations } from "next-intl";
import { HeroJourney } from "./HeroJourney";

/**
 * The home page's welcome (specs/007-caravansara-theme, FR-009). Since feature 041 (owner's request) the
 * picture is a short story told by scrolling: a car with three passengers drives along a road at the foot of
 * the hero, stops at a caravansara whose gateway frames the owner's courtyard photo (027), and drives on to a
 * city (HeroJourney). It replaces the photo doorway and the row of arches.
 *
 * The title and subtitle sit on the dark sky above the road only, never on the scene, because a contrast
 * check cannot measure text on a picture (data-model: hero); the bottom padding keeps them clear of it.
 */
export function Hero() {
  const t = useTranslations("home");
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden rounded-3xl bg-night text-on-dark"
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_20%_115%,var(--amber)_0%,var(--brick)_30%,var(--foreground)_58%,var(--night)_85%)]"
      />
      <HeroJourney />
      <div className="relative max-w-xl px-6 pt-10 pb-52 md:max-w-[60%] md:px-14 md:pt-14 md:pb-68">
        <h1
          id="hero-title"
          className="animate-rise text-3xl leading-snug font-extrabold md:text-5xl md:leading-tight"
        >
          {t("heroTitle")}
        </h1>
        <p className="mt-3 animate-rise text-base text-gold [animation-delay:150ms] md:text-lg">
          {t("heroSubtitle")}
        </p>
      </div>
    </section>
  );
}
