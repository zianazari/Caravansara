import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Hero } from "@/components/brand/Hero";
import { HomeRows } from "@/components/home/HomeRows";
import { SearchForm } from "@/components/search/SearchForm";
import { todayInZone } from "@/lib/cityTime";

/**
 * The home page in the caravansara theme (specs/007-caravansara-theme, US1): the night hero, the search pill
 * resting on its lower edge, the categories, and one row of top-rated places for each suggested city. The
 * decorative arcade band at the foot was removed in feature 035 (owner's request: it served no purpose). The
 * rows load in the browser as they come into view, so this page renders as fast as in 005.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="grid gap-10" data-wide>
      {/*
        The hero is a short strip with the car's story, pinned under the header for the whole page (feature
        041c, owner's request: always visible at the top). The search pill sits just below it and scrolls under it
        with the page. Sticky needs a tall parent, so the strip is a direct child of the page grid.
      */}
      {/* A direct child of the page's grid, so sticky keeps it under the header for the whole page. */}
      <Hero />
      {/*
        Just below the strip, not overlapping it: the strip stays above everything that scrolls under it, so an
        overlapping pill would be half hidden at the top of the page. -mt-6 trims the grid's gap to 1rem.
      */}
      <SearchForm
        today={todayInZone("UTC")}
        className="relative z-10 mx-auto -mt-6 w-full max-w-4xl px-2 md:px-6"
      />
      {/* The rows read ?category= from the address, which needs a Suspense boundary in the App Router. */}
      <Suspense>
        <HomeRows />
      </Suspense>
    </div>
  );
}
