import { screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { renderIn } from "@/test/render";

const GET = vi.fn();
// The heart's own behaviour is tested in components/wishlist (feature 012).
vi.mock("@/hooks/useWishlist", () => ({
  useWishlist: () => ({ saved: new Set<number>(), toggle: () => {}, ready: true }),
}));
vi.mock("@/api/client", () => ({ api: { GET: (...args: unknown[]) => GET(...args) } }));
vi.mock("next/image", () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CityRow } from "./CityRow";

const tehran = {
  id: 7,
  name: "Tehran",
  timezone: "Asia/Tehran",
  country: { id: 11, code: "IR", name: "Iran" },
};
const result = (id: number) => ({
  id,
  title: `Place ${id}`,
  property_type: "entire_place",
  city: "Tehran",
  country_code: "IR",
  pin: { lat: 35.7, lng: 51.4 },
  distance_km: null,
  avg_rating: "4.9",
  review_count: 4,
  max_guests: 2,
  price_per_night: "30000000.00",
  cleaning_fee: "0.00",
  currency: "IRR",
  total_price: null,
  cover_url: null,
});

/** A row loads only once it comes near the screen (research R4); tests show it at once. */
let visible: (() => void) | undefined;
class FakeObserver {
  constructor(private callback: IntersectionObserverCallback) {
    visible = () => this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as never);
  }
  observe() {}
  disconnect() {}
}

function respond(cities: unknown[], items: unknown[] | "error") {
  GET.mockImplementation((path: string) => {
    if (path === "/api/v1/cities") return Promise.resolve({ data: cities });
    if (items === "error") return Promise.resolve({ error: { error: { code: "service_unavailable" } } });
    return Promise.resolve({ data: { items, total: items.length, limit: 8, offset: 0 } });
  });
}

describe("CityRow (specs/007-caravansara-theme, FR-013)", () => {
  beforeEach(() => {
    GET.mockReset();
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("asks for nothing until the row comes near the screen", async () => {
    respond([tehran], [result(1)]);
    renderIn("fa", <CityRow city="Tehran" />);
    expect(GET).not.toHaveBeenCalled();
    visible!();
    await screen.findByRole("heading", { name: /محبوب در تهران/ });
  });

  it("shows the city's best places, top rated first, with a link to all of them", async () => {
    respond([{ ...tehran, id: 70, name: "Tehranpars" }, tehran], [result(1), result(2)]);
    renderIn("fa", <CityRow city="Tehran" />);
    visible!();
    expect(await screen.findByRole("heading", { name: /محبوب در تهران/ })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /نمایش همه/ })).toHaveAttribute(
      "href",
      "/search?city_id=7&adults=1",
    );
    // The exact city name, not the first suggestion (Tehranpars).
    expect(GET).toHaveBeenCalledWith("/api/v1/search/listings", {
      params: { query: { city_id: 7, sort: "rating", limit: 12 } },
    });
  });

  it("filters by the chosen category and carries it to the search", async () => {
    respond([tehran], [result(1)]);
    renderIn("fa", <CityRow city="Tehran" category="sauna" filter={{ amenity_ids: [26] }} />);
    visible!();
    await screen.findByRole("heading", { name: /محبوب در تهران/ });
    expect(GET).toHaveBeenCalledWith("/api/v1/search/listings", {
      params: { query: { city_id: 7, sort: "rating", limit: 12, amenity_ids: [26] } },
    });
    expect(screen.getByRole("link", { name: /نمایش همه/ })).toHaveAttribute(
      "href",
      "/search?city_id=7&adults=1&amenity_ids=26&category=sauna",
    );
  });

  it.each([
    ["the city is not found", [], [result(1)]],
    ["the city has no places", [tehran], []],
    ["the search fails", [tehran], "error" as const],
  ])("shows no row when %s (US1/AC5)", async (_case, cities, items) => {
    respond(cities, items);
    const { container } = renderIn("fa", <CityRow city="Tehran" />);
    visible!();
    await waitFor(() => expect(GET).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("heading")).toBeNull();
    expect(container.querySelector("article")).toBeNull();
  });
});
