import { useTranslations } from "next-intl";
import type { components } from "@/api/schema";
import { amenityIcon } from "@/lib/amenityIcons";
import { amenityCategoryName, amenityName } from "@/lib/names";

type Category = components["schemas"]["AmenityCategoryOut"];

/**
 * Amenities grouped by category, in the page's language (FR-021), each with its line icon before the name
 * (feature 018). The icon is decoration: the name says the same.
 */
export function AmenityList({ categories }: { categories: Category[] }) {
  const t = useTranslations();
  const shown = categories.filter((c) => c.amenities.length > 0);
  if (shown.length === 0) return <p className="text-muted-foreground">{t("listing.noAmenities")}</p>;
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {shown.map((category) => (
        <div key={category.id}>
          <h3 className="mb-2 font-semibold">{amenityCategoryName(t, category.name)}</h3>
          <ul className="grid gap-3">
            {category.amenities.map((amenity) => {
              const Icon = amenityIcon(amenity);
              return (
                <li key={amenity.id} className="flex items-center gap-3">
                  <Icon className="size-6 shrink-0 stroke-[1.5]" aria-hidden />
                  <span>{amenityName(t, amenity.name)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
