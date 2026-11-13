import { HeartButton } from "@/components/wishlist/HeartButton";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { components } from "@/api/schema";
import { serverApi } from "@/api/server";
import { UserAvatar } from "@/components/account/UserAvatar";
import { StarIcon } from "lucide-react";
import { AmenityPreview } from "@/components/listing/AmenityPreview";
import { AreaMap } from "@/components/listing/AreaMap";
import { AvailabilityCalendar } from "@/components/listing/AvailabilityCalendar";
import { BookingBox } from "@/components/listing/BookingBox";
import { StayDatesProvider } from "@/components/listing/StayDates";
import { MobileBookingBar } from "@/components/listing/MobileBookingBar";
import { Gallery } from "@/components/listing/Gallery";
import { HostCard, Highlights, SleepCard, ThingsToKnow } from "@/components/listing/ListingSections";
import { ReviewList } from "@/components/listing/ReviewList";
import { ReviewSummary } from "@/components/listing/ReviewSummary";
import { SectionNav } from "@/components/listing/SectionNav";
import { ShareButton } from "@/components/listing/ShareButton";
import { ShowMoreText } from "@/components/listing/ShowMoreText";
import { cityName, countryName } from "@/lib/names";

type Listing = components["schemas"]["ListingOut"];
type Props = { params: Promise<{ locale: string; id: string }> };

type Loaded = {
  listing: Listing;
  reviews: components["schemas"]["ReviewPage"];
  summary: components["schemas"]["ReviewSummary"] | null;
};

async function load(id: string): Promise<Loaded | null> {
  const listingId = Number(id);
  if (!Number.isInteger(listingId) || listingId <= 0) return null;
  const api = serverApi();
  const path = { listing_id: listingId };
  const [{ data: listing }, { data: reviews }, { data: summary }] = await Promise.all([
    api.GET("/api/v1/listings/{listing_id}", { params: { path } }),
    api.GET("/api/v1/listings/{listing_id}/reviews", { params: { path, query: { limit: 10 } } }),
    api.GET("/api/v1/listings/{listing_id}/reviews/summary", { params: { path } }),
  ]);
  return listing ? { listing, reviews: reviews ?? { items: [], total: 0 }, summary: summary ?? null } : null;
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
  const { listing, reviews, summary } = found;
  const t = await getTranslations();
  const city = cityName(t, listing.city.name);
  const country = countryName(listing.city.country.code, locale);
  const tag = locale === "fa" ? "fa-IR" : "en";
  const rating = listing.avg_rating
    ? new Intl.NumberFormat(tag, { maximumFractionDigits: 2 }).format(Number(listing.avg_rating))
    : null;
  const facts = [
    t("listing.maxGuests", { count: listing.max_guests }),
    t("listing.bedrooms", { count: listing.bedrooms }),
    t("listing.beds", { count: listing.beds }),
    t("listing.baths", { count: Number(listing.bathrooms) }),
  ];

  return (
    // Feature 034 (owner's request): a narrower column with wider margins, so lines and sections do not
    // stretch across a wide screen; 1152 px at most, centred, about what booking sites use for a room page.
    // This undoes 019's full width for this page only; the lists (home, search) stay wide.
    // Feature 032: the sections and their order follow a room page on a booking site (owner's request).
    <article className="mx-auto grid w-full max-w-6xl gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold md:text-3xl">{listing.title}</h1>
        <div className="flex items-center gap-1">
          <ShareButton title={listing.title} />
          <HeartButton listingId={listing.id} title={listing.title} className="shrink-0" />
        </div>
      </header>

      <div id="photos" className="scroll-mt-32">
        <Gallery photos={listing.photos} title={listing.title} />
      </div>
      <SectionNav />

      {/* The calendar and the booking box share one choice of dates (feature 019). */}
      <Suspense>
        <StayDatesProvider listingId={listing.id} timezone={listing.city.timezone}>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,5fr)_minmax(0,2fr)]">
            <div className="grid content-start gap-8">
              <section className="grid gap-1">
                <h2 className="text-xl font-bold md:text-2xl">
                  {t("listing.typeIn", { type: t(`propertyTypes.${listing.property_type}`), city, country })}
                </h2>
                <p className="text-muted-foreground">{facts.join(t("listing.factsSeparator"))}</p>
                <a
                  href="#reviews"
                  className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full py-1 font-semibold transition-colors hover:text-primary"
                >
                  <StarIcon className="size-4 fill-current" aria-hidden />
                  {rating
                    ? t("listing.ratingLine", { rating, count: listing.review_count })
                    : t("listing.newPlace")}
                </a>
              </section>

              <section className="flex items-center gap-4 border-t pt-6">
                <UserAvatar user={listing.host} />
                <p className="text-lg font-semibold">
                  {t("listing.hostedBy", { name: listing.host.full_name })}
                </p>
              </section>

              <Highlights listing={listing} city={city} />

              {listing.description ? (
                <section aria-labelledby="about" className="reveal grid gap-4 border-t pt-8">
                  <h2 id="about" className="text-2xl font-bold">
                    {t("listing.description")}
                  </h2>
                  <ShowMoreText text={listing.description} />
                </section>
              ) : null}

              <SleepCard listing={listing} />

              <section
                id="amenities"
                aria-labelledby="amenities-title"
                className="reveal grid scroll-mt-32 gap-6 border-t pt-8"
              >
                <h2 id="amenities-title" className="text-2xl font-bold">
                  {t("listing.offers")}
                </h2>
                <AmenityPreview categories={listing.amenities} />
              </section>

              <AvailabilityCalendar
                city={city}
                listing={{ ...listing, countryCode: listing.city.country.code }}
              />
            </div>
            <div id="booking" className="scroll-mt-24 lg:sticky lg:top-32 lg:self-start">
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
                    countryCode: listing.city.country.code,
                  }}
                />
              </Suspense>
            </div>
          </div>
        </StayDatesProvider>
      </Suspense>

      {/* Full width below the two columns: reviews, the area, the host and the rules. */}
      <section
        id="reviews"
        aria-labelledby="reviews-title"
        className="reveal grid scroll-mt-32 gap-8 border-t pt-8"
      >
        <h2 id="reviews-title" className="flex items-center gap-2 text-2xl font-bold">
          <StarIcon className="size-6 fill-current" aria-hidden />
          {rating ? t("listing.reviewsTitle", { rating, count: listing.review_count }) : t("listing.reviews")}
        </h2>
        {summary && summary.total > 0 ? <ReviewSummary summary={summary} /> : null}
        <ReviewList listingId={listing.id} first={reviews} />
      </section>

      <section id="location" aria-labelledby="where" className="reveal grid scroll-mt-32 gap-4 border-t pt-8">
        <h2 id="where" className="text-2xl font-bold">
          {t("listing.where")}
        </h2>
        <p className="font-semibold">
          {listing.neighborhood ? `${listing.neighborhood}${locale === "fa" ? "، " : ", "}` : ""}
          {city}
          {locale === "fa" ? "، " : ", "}
          {country}
        </p>
        <p className="text-sm text-muted-foreground">{t("listing.whereText")}</p>
        <AreaMap lat={listing.pin.lat} lng={listing.pin.lng} />
      </section>

      <HostCard listing={listing} />
      <ThingsToKnow listing={listing} city={city} />

      <MobileBookingBar price={listing.price_per_night} currency={listing.currency} />
    </article>
  );
}
