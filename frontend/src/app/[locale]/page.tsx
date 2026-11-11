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
        Feature 041b (owner's request: the whole story is seen while scrolling): the hero and the search pill
        are pinned under the header and fill the screen while the car's trip plays, over --trip of extra
        scroll; then they scroll away and the rows follow. Filling the screen leaves no blank space under the
        pill. Under reduced motion nothing is pinned and the page is as before.
      */}
      <div
        data-hero-stage
        className="h-[calc(100svh-var(--below)+var(--trip))] [--below:calc(5.25rem+4.5rem+env(safe-area-inset-bottom))] [--trip:1100px] motion-reduce:h-auto md:[--below:5.25rem] md:[--trip:1400px]"
      >
        {/* --below: the header and page margin above, and on a phone the bottom bar (4.5rem) under it. */}
        <div className="sticky top-[4.25rem] flex h-[calc(100svh-var(--below))] min-h-[30rem] flex-col motion-reduce:static motion-reduce:h-auto">
          <Hero className="min-h-0 flex-1" />
          <SearchForm
            today={todayInZone("UTC")}
            className="relative z-10 mx-auto -mt-8 w-full max-w-4xl px-2 md:-mt-10 md:px-6"
          />
        </div>
      </div>
      {/* The rows read ?category= from the address, which needs a Suspense boundary in the App Router. */}
      <Suspense>
        <HomeRows />
      </Suspense>
    </div>
  );
}
