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
import type { KeyboardEvent } from "react";
import { api } from "@/api/client";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { type CategoryKey, activeCategory, categoriesFor, filterOf } from "@/lib/categories";

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
 * The row of categories under the search (specs/007-caravansara-theme, US3, FR-014): each an icon in the
 * caravansara arch with its name, the active one copper and underlined. They are links, so the address, the
 * back button and a shared link all keep the choice (?category=).
 *
 * On the home page a category only changes ?category=, and the city rows filter themselves: the home page has
 * no city to send the visitor to (research R6). On the search page it sets the search's own filters (an
 * amenity, or pets) and starts again from the first page; if the filters panel later changes them, the row
 * shows "all" again, so there is never a category that does not match the results.
 */
export function CategoryBar({ mode }: { mode: "home" | "search" }) {
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
    <nav aria-label={t("label")} onKeyDown={onKeyDown} className="min-w-0 border-b">
      <ul className="-mx-4 flex snap-x scroll-px-4 gap-7 overflow-x-auto px-4 md:mx-0 md:justify-center md:px-0">
        {offered.map((category) => {
          const Icon = ICONS[category.icon] ?? LayoutGridIcon;
          const on = category.key === active;
          return (
            <li key={category.key} className="snap-start">
              <Link
                href={hrefFor(category.key)}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1.5 border-b-2 pt-1 pb-2.5 text-xs whitespace-nowrap",
                  on
                    ? "border-primary font-bold text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                <span
                  aria-hidden
                  className={cn("arch grid h-9 w-8 place-items-center", on ? "bg-copper" : "bg-sand-strong")}
                >
                  <Icon className="mt-2 size-4 text-on-dark" />
                </span>
                {t(category.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
