import Image from "next/image";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import cabin from "@/assets/cinematic-cabin.jpg";
import { PopularDestinations } from "./PopularDestinations";
import { HomeSearch } from "./HomeSearch";
import { HomeRows } from "./HomeRows";

/** An independently selected visual direction; listing data and booking behavior stay shared. */
export function CinematicHome({ today }: { today: string }) {
  const t = useTranslations("cinematic");
  return (
    <div className="cinematic-home grid min-w-0 gap-14 md:gap-20" data-wide>
      <div className="cinematic-intro">
        <section
          className="cinematic-cover relative isolate flex min-h-[520px] items-center overflow-hidden bg-hero-shade md:min-h-[620px]"
          aria-labelledby="hero-title"
        >
          <Image
            src={cabin}
            alt={t("photo")}
            fill
            preload
            sizes="100vw"
            className="object-cover object-[35%_center] md:object-center"
          />
          <div className="cinematic-scrim absolute inset-0" />
          <div className="relative mx-auto w-full max-w-[1600px] px-7 pt-20 pb-32 text-on-dark md:px-14 md:pt-24 md:pb-36 lg:px-20">
            <span className="mb-7 block h-1 w-16 bg-copper" aria-hidden />
            <h1
              id="hero-title"
              className="max-w-2xl text-[clamp(2.4rem,8vw,4.5rem)] leading-[1.6] font-bold tracking-tight"
            >
              {t("title")} <br />
              {t("accent")}
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-9 md:text-2xl">{t("description")}</p>
          </div>
        </section>
        <HomeSearch today={today} />
      </div>
      <PopularDestinations />
      <section
        id="stays"
        aria-labelledby="stays-title"
        className="grid min-w-0 scroll-mt-44 gap-8 border-t pt-10"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="stays-title" className="text-2xl font-bold md:text-3xl">
            {t("stays")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("staysNote")}</p>
        </div>
        <Suspense>
          <HomeRows />
        </Suspense>
      </section>
    </div>
  );
}
