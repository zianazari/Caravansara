import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/**
 * The site's mark (feature 027, owner's choice "ب"): two nested pointed arches drawn as lines on a base
 * line, after the first logo of the home-page mockup, whose arches were round. The outer arch is the
 * caravansara's gateway and the inner one its door. Lines rather than a filled shape keep it light next to
 * the name. The favicon (src/app/icon.svg) is the same drawing.
 *
 * Since feature 036 (owner's request: the new logo everywhere) the drawing is LogoMark, used wherever the
 * site shows its mark: the headers, the footer, above the log-in and sign-up forms, and the error and
 * not-found pages, which used the old filled arch.
 *
 * Tones: `light` copper and amber on light backgrounds; `dark` gold and amber on night blue or dark brown,
 * the same pairs as the first logo and the hero; `muted` sand for the large mark of an empty page, which is
 * decoration and must not pull the eye from the message.
 */
type Tone = "light" | "dark" | "muted";

const STROKES: Record<Tone, { outer: string; inner: string }> = {
  light: { outer: "stroke-copper", inner: "stroke-amber" },
  dark: { outer: "stroke-gold", inner: "stroke-amber" },
  muted: { outer: "stroke-sand-strong", inner: "stroke-sand-strong" },
};

export function LogoMark({ tone = "light", className }: { tone?: Tone; className?: string }) {
  const { outer, inner } = STROKES[tone];
  return (
    <svg
      aria-hidden
      data-logo="arches"
      viewBox="0 0 40 44"
      fill="none"
      strokeWidth={2.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-8 w-7 shrink-0", className)}
    >
      <path d="M6 42V21C6 13.5 11.8 8.4 20 4C28.2 8.4 34 13.5 34 21V42" className={outer} />
      <path d="M14 42V26.08C14 20.4 16.49 16.53 20 13.2C23.51 16.53 26 20.4 26 26.08V42" className={inner} />
      <path d="M2 42h36" className={outer} />
    </svg>
  );
}

/** The mark with the site's name, for the headers. `onDark` is the admin panel's night-blue header. */
export function Logo({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  const t = useTranslations("common");
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-xl font-extrabold",
        onDark ? "text-gold" : "text-primary",
        className,
      )}
    >
      <LogoMark tone={onDark ? "dark" : "light"} />
      {t("siteName")}
    </span>
  );
}
