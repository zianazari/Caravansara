import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { components } from "@/api/schema";
import { serverApi } from "@/api/server";
import { UserAvatar } from "@/components/account/UserAvatar";
import { AmenityList } from "@/components/listing/AmenityList";
import { BookingBox } from "@/components/listing/BookingBox";
import { Gallery } from "@/components/listing/Gallery";
import { ReviewList } from "@/components/listing/ReviewList";
import { formatClock } from "@/lib/cityTime";
import { cityName, countryName } from "@/lib/names";

type Listing = components["schemas"]["ListingOut"];
type Props = { params: Promise<{ locale: string; id: string }> };

async function load(
  id: string,
): Promise<{ listing: Listing; reviews: components["schemas"]["ReviewPage"] } | null> {
  const listingId = Number(id);
  if (!Number.isInteger(listingId) || listingId <= 0) return null;
  const api = serverApi();
  const [{ data: listing }, { data: reviews }] = await Promise.all([
    api.GET("/api/v1/listings/{listing_id}", { params: { path: { listing_id: listingId } } }),
    api.GET("/api/v1/listings/{listing_id}/reviews", {
      params: { path: { listing_id: listingId }, query: { limit: 10 } },
    }),
  ]);
  return listing ? { listing, reviews: reviews ?? { items: [], total: 0 } } : null;
}

/** Each listing page has its own title and description, for search engines and link previews (FR-022). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const found = await load(id);
  if (!found) return {};
  const { listing } = found;
  const description = (listing.description ?? "").replace(/\s+/g, " ").slice(0, 160);
  return {
    title: listing.title,
    description,
    openGraph: { title: listing.title, description, images: listing.photos[0]?.url },
  };
}

/**
 * The public listing page (US1/AC6, FR-021, FR-022), rendered on the server without any token. A listing that
 * does not exist or is not public gets the translated "not found" page (US1/AC7). The exact address is never
 * part of this page: only the approximate pin the API makes public (FR-018, SC-005).
 */
export default async function ListingPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const found = await load(id);
  if (!found) notFound();
  const { listing, reviews } = found;
  const t = await getTranslations();
  const city = cityName(t, listing.city.name);
  const number = (n: number) => new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en").format(n);
  const rating = listing.avg_rating ? number(Number(listing.avg_rating)) : null;

  return (
    <article className="grid gap-8">
      <header className="grid gap-1">
        <h1 className="text-2xl font-bold md:text-3xl">{listing.title}</h1>
        <p className="text-muted-foreground">
          {t(`propertyTypes.${listing.property_type}`)} · {city}
          {locale === "fa" ? "، " : ", "}
          {countryName(listing.city.country.code, locale)}
          {listing.neighborhood ? ` · ${t("listing.neighborhood", { name: listing.neighborhood })}` : ""}
          {rating ? ` · ★ ${rating} (${number(listing.review_count)})` : ""}
        </p>
      </header>

      <Gallery photos={listing.photos} title={listing.title} />

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="grid content-start gap-8">
          <section className="flex items-center gap-3">
            <UserAvatar user={listing.host} />
            <p className="font-medium">{t("listing.hostedBy", { name: listing.host.full_name })}</p>
          </section>

          <section aria-labelledby="capacity" className="grid gap-2">
            <h2 id="capacity" className="text-xl font-semibold">
              {t("listing.capacity")}
            </h2>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
              <li>{t("listing.maxGuests", { count: listing.max_guests })}</li>
              <li>{t("listing.bedrooms", { count: listing.bedrooms })}</li>
              <li>{t("listing.beds", { count: listing.beds })}</li>
              <li>{t("listing.bathrooms", { count: Number(listing.bathrooms) })}</li>
              <li>
                {listing.pets_allowed
                  ? t("listing.petsAllowed", { count: listing.max_pets })
                  : t("listing.noPets")}
              </li>
            </ul>
          </section>

          {listing.description ? (
            <section aria-labelledby="about" className="grid gap-2">
              <h2 id="about" className="text-xl font-semibold">
                {t("listing.description")}
              </h2>
              <p className="whitespace-pre-line">{listing.description}</p>
            </section>
          ) : null}

          <section aria-labelledby="amenities" className="grid gap-3">
            <h2 id="amenities" className="text-xl font-semibold">
              {t("listing.amenities")}
            </h2>
            <AmenityList categories={listing.amenities} />
          </section>

          <section aria-labelledby="times" className="grid gap-1">
            <h2 id="times" className="text-xl font-semibold">
              {t("listing.checkTimes")}
            </h2>
            <p>{t("listing.checkIn", { time: formatClock(listing.check_in_time, locale), city })}</p>
            <p>{t("listing.checkOut", { time: formatClock(listing.check_out_time, locale), city })}</p>
            <p className="text-sm text-muted-foreground">{t("listing.approximate")}</p>
          </section>

          <section aria-labelledby="reviews" className="grid gap-3">
            <h2 id="reviews" className="text-xl font-semibold">
              {t("listing.reviews")}
            </h2>
            <ReviewList listingId={listing.id} first={reviews} />
          </section>
        </div>
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Suspense>
            <BookingBox
              listing={{
                id: listing.id,
                host_id: listing.host.id,
                price_per_night: listing.price_per_night,
                cleaning_fee: listing.cleaning_fee,
                currency: listing.currency,
                max_guests: listing.max_guests,
                pets_allowed: listing.pets_allowed,
                max_pets: listing.max_pets,
                timezone: listing.city.timezone,
              }}
            />
          </Suspense>
        </div>
      </div>
    </article>
  );
}
