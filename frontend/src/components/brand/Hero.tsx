import Image from "next/image";
import { ArrowDownLeftIcon, MapPinIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import courtyard from "@/assets/hero-boutique.jpg";
import { cn } from "@/lib/cn";

/** Atmospheric cover, separate from listing photography: it never advertises a specific property. */
export function Hero({ className }: { className?: string }) {
  const t = useTranslations("home");
  return (
    <section
      aria-labelledby="hero-title"
      className={cn(
        "relative isolate min-h-[440px] overflow-hidden rounded-[1.75rem] bg-hero-shade md:min-h-[530px] md:rounded-[2.25rem]",
        className,
      )}
    >
      <Image
        src={courtyard}
        alt={t("heroPhoto")}
        fill
        preload
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="boutique-hero-shade absolute inset-0" />
      <div className="relative flex min-h-[440px] flex-col items-start justify-center px-7 pt-10 pb-24 text-on-dark md:min-h-[530px] md:px-16 md:pt-12 md:pb-28 lg:px-20">
        <p className="mb-5 flex items-center gap-3 text-sm font-medium tracking-wide">
          <span className="h-px w-9 bg-gold" />
          {t("heroEyebrow")}
        </p>
        <h1
          id="hero-title"
          className="max-w-3xl text-[clamp(1.875rem,9.5vw,2.5rem)] leading-[1.65] font-semibold tracking-tight md:text-[4rem] md:leading-[1.5] lg:text-[4.5rem]"
        >
          {t("heroTitle")} <br />
          <span className="text-gold">{t("heroTitleAccent")}</span>
        </h1>
        <p className="mt-4 max-w-xl text-base leading-8 md:text-lg">{t("heroDescription")}</p>
        <a
          href="#stays"
          className="mt-6 inline-flex items-center gap-3 rounded-full border border-on-dark/50 px-5 py-2.5 text-base font-medium transition-colors hover:bg-hero-shade focus-visible:outline-on-dark"
        >
          {t("explore")}
          <ArrowDownLeftIcon className="size-4 ltr:-rotate-90" aria-hidden />
        </a>
      </div>
      <p className="absolute end-7 bottom-8 hidden items-center gap-2 rounded-full bg-hero-shade px-4 py-2 text-xs text-on-dark lg:flex">
        <MapPinIcon className="size-3.5" aria-hidden />
        {t("heroCaption")}
      </p>
    </section>
  );
}
