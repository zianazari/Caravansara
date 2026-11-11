import {
  AwardIcon,
  BedDoubleIcon,
  CarIcon,
  KeyRoundIcon,
  MapPinIcon,
  PawPrintIcon,
  StarIcon,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { components } from "@/api/schema";
import { UserAvatar } from "@/components/account/UserAvatar";
import { ArchFrame } from "@/components/brand/ArchFrame";
import { badgeOf } from "@/lib/badge";
import { formatClock } from "@/lib/cityTime";
import { amenityName } from "@/lib/names";

type Listing = components["schemas"]["ListingOut"];

/**
 * The listing page's sections after feature 032, in the order of a room page on a booking site. Every line
 * comes from the listing's own data: a highlight or a safety line is shown only when the data says so, and
 * nothing is said about the host that the API does not know.
 */

const has = (listing: Listing, name: string) =>
  listing.amenities.some((c) => c.amenities.some((a) => a.name === name));

/** Up to three highlights, each only when it is true of this listing. */
export function Highlights({ listing, city }: { listing: Listing; city: string }) {
  const t = useTranslations("listing");
  const locale = useLocale();
  const rating = new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en", { maximumFractionDigits: 2 }).format(
    Number(listing.avg_rating ?? 0),
  );
  const items: { Icon: LucideIcon; title: string; text: string }[] = [];
  if (badgeOf(listing) === "guest_favourite") {
    items.push({
      Icon: AwardIcon,
      title: t("hlFavourite"),
      text: t("hlFavouriteText", { rating, count: listing.review_count }),
    });
  }
  if (listing.neighborhood) {
    items.push({
      Icon: MapPinIcon,
      title: t("hlArea", { area: `${listing.neighborhood}${locale === "fa" ? "، " : ", "}${city}` }),
      text: t("hlAreaText"),
    });
  }
  if (has(listing, "Self check-in")) {
    items.push({ Icon: KeyRoundIcon, title: t("hlSelfCheckIn"), text: t("hlSelfCheckInText") });
  }
  if (listing.pets_allowed) {
    items.push({
      Icon: PawPrintIcon,
      title: t("hlPets"),
      text: t("hlPetsText", { count: listing.max_pets }),
    });
  }
  if (has(listing, "Free parking")) {
    items.push({ Icon: CarIcon, title: t("hlParking"), text: t("hlParkingText") });
  }
  if (items.length === 0) return null;
  return (
    <section aria-label={t("highlights")} className="reveal grid gap-6 border-t pt-8">
      {items.slice(0, 3).map(({ Icon, title, text }) => (
        <div key={title} className="flex items-start gap-5">
          <Icon className="mt-0.5 size-7 shrink-0 stroke-[1.5]" aria-hidden />
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{text}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

/** Where you will sleep: a bedroom photo if the host labelled one, and the number of rooms and beds. */
export function SleepCard({ listing }: { listing: Listing }) {
  const t = useTranslations("listing");
  const bedroom = listing.photos.find((p) => /bed|خواب/i.test(`${p.room_tag ?? ""} ${p.caption ?? ""}`));
  return (
    <section aria-labelledby="sleep" className="reveal grid gap-4 border-t pt-8">
      <h2 id="sleep" className="text-2xl font-bold">
        {t("whereSleep")}
      </h2>
      <div className="lift grid w-full max-w-xs gap-3 rounded-2xl">
        <ArchFrame src={bedroom?.url} alt="" sizes="320px" className="aspect-[4/3]" />
        <p className="flex items-center gap-2 font-semibold">
          <BedDoubleIcon className="size-5 stroke-[1.5]" aria-hidden />
          {t("sleepCard", { bedrooms: listing.bedrooms, beds: listing.beds })}
        </p>
      </div>
    </section>
  );
}

/** Meet your host: who they are and this place's own numbers, which is all the API knows about hosts. */
export function HostCard({ listing }: { listing: Listing }) {
  const t = useTranslations("listing");
  const locale = useLocale();
  const rating = listing.avg_rating
    ? new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en", { maximumFractionDigits: 2 }).format(
        Number(listing.avg_rating),
      )
    : null;
  return (
    <section aria-labelledby="meet-host" className="reveal grid gap-4 border-t pt-8">
      <h2 id="meet-host" className="text-2xl font-bold">
        {t("meetHost")}
      </h2>
      <div className="lift flex max-w-md items-center gap-6 rounded-3xl border bg-card p-6 shadow-lg shadow-foreground/10">
        <div className="grid justify-items-center gap-2 text-center">
          <UserAvatar user={listing.host} size="lg" />
          <p className="text-xl font-bold">{listing.host.full_name}</p>
          <p className="text-sm text-muted-foreground">{t("host")}</p>
        </div>
        <div className="grid gap-3 border-s ps-6 text-sm">
          <p>{t("hostPlaceStats", { count: listing.review_count })}</p>
          {rating ? (
            <p className="flex items-center gap-1 font-semibold">
              <StarIcon className="size-4 fill-current" aria-hidden />
              {t("hostRating", { rating })}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Things to know: the house rules, safety equipment the host listed, and the cancellation rule. */
export function ThingsToKnow({ listing, city }: { listing: Listing; city: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const safety = ["Smoke alarm", "Carbon monoxide alarm", "Fire extinguisher", "First aid kit"];
  const columns = [
    {
      title: t("listing.houseRules"),
      lines: [
        // The times are the city's own, so the line says which clock it means.
        t("listing.checkIn", { time: formatClock(listing.check_in_time, locale), city }),
        t("listing.checkOut", { time: formatClock(listing.check_out_time, locale), city }),
        t("listing.ruleGuests", { count: listing.max_guests }),
        listing.pets_allowed ? t("listing.petsAllowed", { count: listing.max_pets }) : t("listing.noPets"),
      ],
    },
    {
      title: t("listing.safety"),
      lines: safety.map((name) =>
        t(has(listing, name) ? "listing.hasAmenity" : "listing.noAmenity", { name: amenityName(t, name) }),
      ),
    },
    {
      title: t("listing.cancellation"),
      lines: [t("listing.cancelRule", { city }), t("listing.cancelPaid")],
    },
  ];
  return (
    <section aria-labelledby="things" className="reveal grid gap-6 border-t pt-8">
      <h2 id="things" className="text-2xl font-bold">
        {t("listing.thingsToKnow")}
      </h2>
      <div className="grid gap-8 md:grid-cols-3">
        {columns.map(({ title, lines }) => (
          <div key={title} className="grid content-start gap-3">
            <h3 className="font-semibold">{title}</h3>
            <ul className="grid gap-2">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
