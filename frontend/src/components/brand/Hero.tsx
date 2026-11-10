import { useTranslations } from "next-intl";

/**
 * The home page's welcome (specs/007-caravansara-theme, FR-009, research R8): a caravansara at night seen
 * through its lit doorway, drawn here in SVG and CSS rather than a photo. That keeps it to a few kilobytes,
 * sharp at any size and without a request, so the largest thing on the page is the title text and the load
 * stays as fast as in 005 (SC-005). The lamps glow only for visitors who have not asked for less motion.
 *
 * The title and subtitle sit on the night-blue part only, never on the brick glow, because a contrast check
 * cannot measure text on a gradient (data-model: hero). On a phone the doorway shrinks to a corner.
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
      {/* The doorway: a sand frame, a dark brown inside and a warm glow, all in the tall arch. */}
      <div
        aria-hidden
        data-hero="doorway"
        className="absolute bottom-0 start-auto end-6 h-40 w-32 sm:end-10 md:end-14 md:h-[85%] md:w-[30%] md:max-w-sm"
      >
        <div className="arch absolute inset-0 bg-linear-to-b from-sand-strong to-copper" />
        <div className="arch absolute inset-x-[5%] top-[4%] bottom-0 bg-linear-to-b from-foreground to-copper" />
        <div className="arch absolute inset-x-[5%] top-[4%] bottom-0 bg-[radial-gradient(60%_50%_at_50%_88%,var(--gold)_0%,var(--amber)_40%,transparent_75%)]" />
        <div className="absolute inset-x-[18%] bottom-[30%] flex justify-between">
          {[0, 1, 2].map((lamp) => (
            <span
              key={lamp}
              className="hero-glow size-2 rounded-full bg-on-dark shadow-[0_0_14px_5px_var(--amber)] md:size-2.5"
            />
          ))}
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
        <h1 id="hero-title" className="text-3xl leading-snug font-extrabold md:text-5xl md:leading-tight">
          {t("heroTitle")}
        </h1>
        <p className="mt-3 text-base text-gold md:text-lg">{t("heroSubtitle")}</p>
      </div>
    </section>
  );
}
