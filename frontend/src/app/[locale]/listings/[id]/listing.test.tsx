import { screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { expectAccessible, renderIn } from "@/test/render";

const GET = vi.fn();
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
// The heart's own behaviour is tested in components/wishlist (feature 012).
vi.mock("@/hooks/useWishlist", () => ({
  useWishlist: () => ({ saved: new Set<number>(), toggle: () => {}, ready: true }),
}));
vi.mock("@/api/server", () => ({ serverApi: () => ({ GET }) }));
vi.mock("@/api/client", () => ({ api: { GET: vi.fn() } }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound: () => notFound(),
  useSearchParams: () => new URLSearchParams("check_in=2027-01-10&check_out=2027-01-13&adults=2"),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("@/hooks/useAuth", () => ({ useMe: () => ({ data: undefined }) }));
vi.mock("next-intl/server", async () => (await import("@/test/serverIntl")).serverIntlMock());
vi.mock("next/image", () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}));

import ListingPage, { generateMetadata } from "./page";

const listing = {
  id: 12,
  title: "Garden flat in Tajrish",
  description: "Quiet flat with a garden.\nTen minutes from the metro.",
  property_type: "entire_place",
  city: { id: 7, name: "Tehran", timezone: "Asia/Tehran", country: { id: 11, code: "IR", name: "Iran" } },
  neighborhood: "Tajrish",
  pin: { lat: 35.81, lng: 51.43 },
  max_guests: 4,
  pets_allowed: true,
  max_pets: 1,
  bedrooms: 2,
  beds: 3,
  bathrooms: "1.5",
  price_per_night: "50000000.00",
  cleaning_fee: "5000000.00",
  currency: "IRR",
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
  avg_rating: "4.80",
  review_count: 1,
  is_active: true,
  host: { id: 3, full_name: "Ava Moradi", avatar_url: null },
  photos: [
    {
      id: 2,
      url: "http://localhost:9000/caravansara-media/listings/12/b.jpg",
      storage_key: "b",
      width: 1,
      height: 1,
      caption: null,
      room_tag: "Kitchen",
      sort_order: 1,
    },
    {
      id: 1,
      url: "http://localhost:9000/caravansara-media/listings/12/a.jpg",
      storage_key: "a",
      width: 1,
      height: 1,
      caption: "Garden",
      room_tag: null,
      sort_order: 0,
    },
  ],
  amenities: [{ id: 6, name: "Internet and office", amenities: [{ id: 18, name: "Wifi", icon: null }] }],
  // Present only to prove the page never prints it (SC-005); the API sends it only to the host.
  private_location: { address: "Secret Street 9, Tehran", latitude: 35.80123, longitude: 51.42987 },
  review: null,
};
const reviews = {
  total: 1,
  items: [
    {
      id: 5,
      booking_id: 9,
      listing_id: 12,
      author: { id: 4, full_name: "Omar Haddad", avatar_url: "https://example.com/x.png" },
      rating: 5,
      cleanliness_rating: 5,
      accuracy_rating: 4,
      check_in_rating: null,
      communication_rating: 5,
      location_rating: 5,
      value_rating: 4,
      comment: "Lovely stay.",
      created_at: "2026-10-02T10:00:00Z",
    },
  ],
};

function answer() {
  GET.mockImplementation(async (path: string) =>
    path.endsWith("/reviews") ? { data: reviews } : { data: listing },
  );
}

async function show(locale: "fa" | "en") {
  const ui = await ListingPage({ params: Promise.resolve({ locale, id: "12" }) });
  return renderIn(locale, ui);
}

describe("listing page", () => {
  beforeEach(() => {
    GET.mockReset();
    notFound.mockClear();
  });

  it("shows every part of the listing (FR-021, US1/AC6)", async () => {
    answer();
    await show("fa");
    expect(screen.getByRole("heading", { level: 1, name: "Garden flat in Tajrish" })).toBeInTheDocument();
    expect(screen.getByText(/کل اقامتگاه · تهران/)).toBeInTheDocument();
    expect(screen.getByText("۴ مهمان")).toBeInTheDocument();
    expect(screen.getByText("حداکثر ۱ حیوان خانگی")).toBeInTheDocument();
    expect(screen.getByText("وای‌فای")).toBeInTheDocument();
    expect(screen.getByText("ورود از ۱۵:۰۰ به وقت تهران")).toBeInTheDocument();
    // 007: the price is in the booking box and, for phones, in the fixed booking bar (FR-007).
    expect(
      within(screen.getByRole("complementary", { name: "قیمت" })).getByText("۵٬۰۰۰٬۰۰۰ تومان هر شب"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "رزرو" })).toHaveAttribute("href", "#booking");
    expect(screen.getByText("Lovely stay.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Garden" })).toBeInTheDocument(); // the cover comes first
  });

  it("never prints the exact address or point (FR-018, SC-005)", async () => {
    answer();
    const { container } = await show("en");
    const html = container.innerHTML;
    expect(html).not.toContain("Secret Street");
    expect(html).not.toContain("35.80123");
    expect(html).not.toContain("51.42987");
  });

  it("shows a reviewer's outside picture as the default avatar instead (FR-041)", async () => {
    answer();
    await show("en");
    expect(screen.queryByRole("img", { name: "Omar Haddad" })).toHaveTextContent("O");
    expect(document.body.innerHTML).not.toContain("example.com");
  });

  it("answers not found for a listing that is missing or not public (US1/AC7)", async () => {
    GET.mockResolvedValue({ error: { error: { code: "not_found" } } });
    await expect(ListingPage({ params: Promise.resolve({ locale: "fa", id: "999" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    await expect(ListingPage({ params: Promise.resolve({ locale: "fa", id: "abc" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("has its own title and description (FR-022)", async () => {
    answer();
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "en", id: "12" }) });
    expect(meta.title).toBe("Garden flat in Tajrish");
    expect(meta.description).toBe("Quiet flat with a garden. Ten minutes from the metro.");
  });

  it("is accessible", async () => {
    answer();
    const { container } = await show("fa");
    await expectAccessible(container);
  });
});
