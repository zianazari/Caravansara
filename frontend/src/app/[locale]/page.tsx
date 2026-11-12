import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { ArrowUpLeftIcon, HouseIcon, DoorOpenIcon, PawPrintIcon } from "lucide-react";
import { Hero } from "@/components/brand/Hero";
import { HeroJourney } from "@/components/brand/HeroJourney";
import { HomeRows } from "@/components/home/HomeRows";
import { HomeSearch } from "@/components/home/HomeSearch";
import { Link } from "@/i18n/navigation";
import { todayInZone } from "@/lib/cityTime";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "home" });
  const collections = [
    { key: "entire_place", title: "stayEntire", note: "stayEntireNote", Icon: HouseIcon },
    { key: "private_room", title: "stayRoom", note: "stayRoomNote", Icon: DoorOpenIcon },
    { key: "pets", title: "stayPets", note: "stayPetsNote", Icon: PawPrintIcon },
  ] as const;
  return (
    <div className="mx-auto grid max-w-[1600px] min-w-0 gap-12 md:gap-16" data-wide>
      <div>
        <Hero />
        <HomeSearch today={todayInZone("UTC")} />
      </div>
      <div className="grid gap-3 md:grid-cols-3 md:gap-5">
        {collections.map(({ key, title, note, Icon }) => (
          <Link
            key={key}
            href={`/?category=${key}#stays`}
            className="group flex min-w-0 items-center gap-4 rounded-2xl border border-border/70 bg-card p-5 transition-colors hover:border-primary/40 hover:bg-surface md:p-6"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface text-primary">
              <Icon className="size-6" strokeWidth={1.4} aria-hidden />
            </span>
            <span className="grid gap-1">
              <span className="text-base font-bold md:text-lg">{t(title)}</span>
              <span className="text-sm text-muted-foreground">{t(note)}</span>
            </span>
            <ArrowUpLeftIcon
              className="ms-auto size-4 shrink-0 text-primary transition-transform group-hover:-translate-y-1 ltr:rotate-90"
              aria-hidden
            />
          </Link>
        ))}
      </div>
      <section id="stays" aria-labelledby="stays-title" className="grid min-w-0 scroll-mt-44 gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-primary">
              <span className="size-1.5 rounded-full bg-copper" />
              {t("curated")}
            </p>
            <h2 id="stays-title" className="text-2xl leading-relaxed font-bold tracking-tight md:text-4xl">
              {t("staysTitle")}
            </h2>
          </div>
          <p className="max-w-md text-base text-muted-foreground">{t("staysDescription")}</p>
        </div>
        <Suspense>
          <HomeRows />
        </Suspense>
      </section>
      <div className="overflow-hidden rounded-3xl bg-surface px-4 pt-6">
        <p className="text-center text-sm font-medium text-muted-foreground">{t("journeyNote")}</p>
        <div className="relative h-32 md:h-44">
          <HeroJourney />
        </div>
      </div>
    </div>
  );
}
