import { useTranslations } from "next-intl";
import type { components } from "@/api/schema";
import { amenityCategoryName, amenityName } from "@/lib/names";

type Category = components["schemas"]["AmenityCategoryOut"];

/** Amenities grouped by category, in the page's language (FR-021). */
export function AmenityList({ categories }: { categories: Category[] }) {
  const t = useTranslations();
  const shown = categories.filter((c) => c.amenities.length > 0);
  if (shown.length === 0) return <p className="text-muted-foreground">{t("listing.noAmenities")}</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {shown.map((category) => (
        <div key={category.id}>
          <h3 className="mb-1 font-semibold">{amenityCategoryName(t, category.name)}</h3>
          <ul className="grid gap-1 text-muted-foreground">
            {category.amenities.map((amenity) => (
              <li key={amenity.id}>{amenityName(t, amenity.name)}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
