"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BathIcon,
  CircleParkingIcon,
  CookingPotIcon,
  DoorClosedIcon,
  FenceIcon,
  FlameIcon,
  HouseIcon,
  LaptopIcon,
  LayoutGridIcon,
  PawPrintIcon,
  UsersIcon,
  WavesIcon,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import type { KeyboardEvent, ReactNode } from "react";
import { api } from "@/api/client";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { type CategoryKey, activeCategory, categoriesFor, filterOf } from "@/lib/categories";
import { ScrollArea } from "@/components/ui/scroll-area";

const ICONS: Record<string, LucideIcon> = {
  LayoutGrid: LayoutGridIcon,
  PawPrint: PawPrintIcon,
  Bath: BathIcon,
  Flame: FlameIcon,
  Waves: WavesIcon,
  Fence: FenceIcon,
  CircleParking: CircleParkingIcon,
  Laptop: LaptopIcon,
  CookingPot: CookingPotIcon,
  House: HouseIcon,
  DoorClosed: DoorClosedIcon,
  Users: UsersIcon,
};

/** The amenity list, shared with the filters panel's names; it changes rarely. */
export function useAmenityGroups() {
  return useQuery({
    queryKey: ["amenities"],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => (await api.GET("/api/v1/amenities")).data,
  });
}

/**
 * The row of categories under the search (specs/007-caravansara-theme, US3, FR-014): each a line icon with its
 * name, the active one copper and underlined (the arch behind the icons was dropped in feature 033), and at the
 * end a filters button for more than one amenity at a time. They are links, so the address, the
 * back button and a shared link all keep the choice (?category=).
 *
 * On the home page a category only changes ?category=, and the city rows filter themselves: the home page has
 * no city to send the visitor to (research R6). On the search page it sets the search's own filters (an
 * amenity, or pets) and starts again from the first page; if the filters panel later changes them, the row
 * shows "all" again, so there is never a category that does not match the results.
 */
export function CategoryBar({
  mode,
  filters,
}: {
  mode: "home" | "search";
  /** The filters button at the end of the row (feature 033), outside the scrolling part so it stays in view. */
  filters?: ReactNode;
}) {
  const t = useTranslations("category");
  const locale = useLocale();
  const pathname = usePathname();
  const params = useSearchParams();
  const groups = useAmenityGroups().data ?? undefined;
  const offered = categoriesFor(groups);

  let active = activeCategory(params.get("category"), groups);
  if (mode === "search" && active !== "all") {
    const want = filterOf(active, groups);
    const ids = params.getAll("amenity_ids");
    const type = params.get("property_type");
    const matches = want.property_type
      ? ids.length === 0 && type === want.property_type
      : want.pets
        ? ids.length === 0 && !type && Number(params.get("pets") ?? 0) >= 1
        : !type && ids.length === 1 && ids[0] === String(want.amenity_ids?.[0]);
    if (!matches) active = "all";
  }

  function hrefFor(key: CategoryKey): string {
    const next = new URLSearchParams(params.toString());
    next.delete("category");
    if (mode === "search") {
      next.delete("amenity_ids");
      next.delete("property_type");
      next.delete("offset");
      if (active === "pets") next.delete("pets");
    }
    if (key !== "all") next.set("category", key);
    if (mode === "search") {
      const filter = filterOf(key, groups);
      for (const id of filter.amenity_ids ?? []) next.append("amenity_ids", String(id));
      if (filter.pets) next.set("pets", String(Math.max(filter.pets, Number(params.get("pets") ?? 0))));
      if (filter.property_type) next.set("property_type", filter.property_type);
    }
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  /** Arrow keys move along the row in reading order: in Persian, left is the next one. */
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const links = [...event.currentTarget.querySelectorAll<HTMLAnchorElement>("a")];
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (index < 0) return;
    const forward = (event.key === "ArrowLeft") === (locale === "fa");
    const target = links[index + (forward ? 1 : -1)];
    if (target) {
      event.preventDefault();
      target.focus();
    }
  }

  return (
    // min-w-0: a grid item is as wide as its content by default, and this row scrolls sideways, so without it the
    // whole page would grow to the row's width on a phone (found by the browser test, SC-004).
    <div className="flex min-w-0 items-center gap-4 border-b">
      <nav aria-label={t("label")} onKeyDown={onKeyDown} className="min-w-0 flex-1">
        {/* A shadcn/ui ScrollArea (feature 026): on a phone the row scrolls with a thin scroll bar. */}
        <ScrollArea orientation="horizontal" viewportClassName="snap-x scroll-px-4" className="-ms-4 md:ms-0">
          <ul className="flex gap-6 px-4 pb-1 md:justify-center md:px-0">
            {offered.map((category) => {
              const Icon = ICONS[category.icon] ?? LayoutGridIcon;
              const on = category.key === active;
              return (
                <li key={category.key} className="snap-start">
                  <Link
                    href={hrefFor(category.key)}
                    aria-current={on ? "true" : undefined}
                    className={cn(
                      // Feature 039 (owner's reference): 16 px names and 28 px icons, easy to read and to hit.
                      "group flex flex-col items-center gap-2 border-b-2 pt-1 pb-3 text-base font-medium whitespace-nowrap transition-colors",
                      on
                        ? "border-primary font-bold text-foreground"
                        : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                    )}
                  >
                    {/* A plain line icon (feature 033): the arch behind each icon made the row heavy. */}
                    <Icon
                      aria-hidden
                      strokeWidth={1.75}
                      className={cn(
                        "size-7 stroke-[1.5] transition-[transform,color] duration-300 ease-(--ease-soft) group-hover:-translate-y-0.5",
                        on ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                      )}
                    />
                    {t(category.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </nav>
      {filters ? <div className="shrink-0 pb-2">{filters}</div> : null}
    </div>
  );
}
