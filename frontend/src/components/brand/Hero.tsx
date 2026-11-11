import Image from "next/image";
import { useTranslations } from "next-intl";
import courtyard from "@/assets/hero-courtyard.jpg";

/**
 * The home page's welcome (specs/007-caravansara-theme, FR-009): a caravansara at night seen through its
 * doorway. Since feature 027 the doorway holds the owner's photo from the README banner, a lit courtyard at
 * dusk, in place of the drawn glow and lamps. The photo is small (450x300), so like the README it sits in the
 * tall arch, about its own size, and is never stretched across the hero, where it would blur.
 *
 * The title and subtitle sit on the night-blue part only, never on the photo, because a contrast check
 * cannot measure text on an image (data-model: hero). On a phone the doorway shrinks to a corner.
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
      {/* The doorway: a sand frame around the courtyard photo, both in the tall arch. */}
      <div
        aria-hidden
        data-hero="doorway"
        className="absolute bottom-0 start-auto end-6 h-40 w-32 sm:end-10 md:end-14 md:h-[85%] md:w-[30%] md:max-w-sm"
      >
        <div className="arch absolute inset-0 bg-linear-to-b from-sand-strong to-copper" />
        <div className="arch absolute inset-x-[5%] top-[4%] bottom-0 overflow-hidden bg-foreground">
          <Image
            src={courtyard}
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 384px, 128px"
            className="animate-drift object-cover"
          />
        </div>
      </div>
      {/* A row of arches along the courtyard, desktop only. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 hidden h-28 gap-4 ps-8 pe-[38%] md:flex md:items-end"
      >
        {[0, 1, 2, 3, 4].map((arch) => (
          <span key={arch} className="arch h-24 flex-1 bg-linear-to-b from-foreground to-night opacity-80" />
        ))}
      </div>
      <div className="relative max-w-xl px-6 pt-10 pb-44 md:max-w-[52%] md:px-14 md:pt-16 md:pb-40">
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
