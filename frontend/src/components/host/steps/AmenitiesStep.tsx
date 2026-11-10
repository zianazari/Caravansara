"use client";

import { useTranslations } from "next-intl";
import { useAmenityGroups } from "@/components/home/CategoryBar";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { amenityCategoryName, amenityName } from "@/lib/names";
import type { StepProps } from "./types";

/** Step 4: amenities from GET /amenities, grouped and named as in the search filters. */
export function AmenitiesStep({ draft, onChange }: StepProps) {
  const t = useTranslations();
  const groups = useAmenityGroups();
  const chosen = draft.amenity_ids ?? [];
  if (groups.isPending) return <Skeleton className="h-48 w-full" />;
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {(groups.data ?? []).map((group) => (
        <fieldset key={group.id} className="grid gap-2">
          <legend className="mb-1 font-semibold">{amenityCategoryName(t, group.name)}</legend>
          {group.amenities.map((amenity) => (
            <label key={amenity.id} className="flex items-center gap-3">
              <Checkbox
                checked={chosen.includes(amenity.id)}
                onCheckedChange={(on) =>
                  onChange({
                    amenity_ids:
                      on === true ? [...chosen, amenity.id] : chosen.filter((id) => id !== amenity.id),
                  })
                }
              />
              <span>{amenityName(t, amenity.name)}</span>
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}
