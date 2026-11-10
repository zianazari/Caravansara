import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { ArcadeBand } from "@/components/brand/ArcadeBand";
import { Hero } from "@/components/brand/Hero";
import { HomeRows } from "@/components/home/HomeRows";
import { SearchForm } from "@/components/search/SearchForm";
import { todayInZone } from "@/lib/cityTime";

/**
 * The home page in the caravansara theme (specs/007-caravansara-theme, US1): the night hero, the search pill
 * resting on its lower edge, the categories, one row of top-rated places for each suggested city, and the
 * arcade band. The rows load in the browser as they come into view, so this page renders as fast as in 005.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="grid gap-10">
      <div>
        <Hero />
        <SearchForm
          today={todayInZone("UTC")}
          className="relative z-10 mx-auto -mt-8 w-full max-w-4xl px-2 md:-mt-10 md:px-6"
        />
      </div>
      {/* The rows read ?category= from the address, which needs a Suspense boundary in the App Router. */}
      <Suspense>
        <HomeRows />
      </Suspense>
      <ArcadeBand />
    </div>
  );
}
