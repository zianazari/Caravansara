import { screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { renderIn } from "@/test/render";

const GET = vi.fn();
vi.mock("@/api/server", () => ({ serverApi: () => ({ GET }) }));
vi.mock("next-intl/server", async () => (await import("@/test/serverIntl")).serverIntlMock());
vi.mock("@/components/search/SearchForm", () => ({ SearchForm: () => <form aria-label="search form" /> }));
// The category row (007) has its own tests; here it only has to be on the page.
vi.mock("@/components/home/CategoryBar", () => ({ CategoryBar: () => <nav aria-label="categories" /> }));
vi.mock("@/components/search/SearchControls", () => ({
  SearchControls: ({ pins }: { pins: { id: number }[] }) => (
    <div data-testid="pins">{pins.map((p) => p.id).join(",")}</div>
  ),
}));
vi.mock("@/components/search/ResultCard", () => ({
  ResultCard: ({ result }: { result: { id: number; title: string } }) => <span>{result.title}</span>,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, rel }: { href: string; children: React.ReactNode; rel?: string }) => (
    <a href={href} rel={rel}>
      {children}
    </a>
  ),
}));

import SearchPage from "./page";

const item = (id: number) => ({
  id,
  title: `Place ${id}`,
  property_type: "entire_place",
  city: "London",
  country_code: "GB",
  pin: { lat: 51.5 + id / 100, lng: -0.1 },
  distance_km: null,
  avg_rating: "4.5",
  review_count: 3,
  max_guests: 2,
  price_per_night: "100.00",
  cleaning_fee: "10.00",
  currency: "GBP",
  total_price: null,
  cover_url: null,
});

async function show(locale: "fa" | "en", query: Record<string, string>) {
  const ui = await SearchPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) });
  return renderIn(locale, ui);
}

describe("search page", () => {
  beforeEach(() => GET.mockReset());

  it("searches on the server with the address's choices, and pages without repeats (US1/AC2, AC5)", async () => {
    GET.mockResolvedValue({ data: { items: [item(1), item(2)], total: 45, limit: 20, offset: 20 } });
    await show("en", { city_id: "3", adults: "2", offset: "20" });
    expect(GET).toHaveBeenCalledWith("/api/v1/search/listings", {
      params: { query: expect.objectContaining({ city_id: 3, adults: 2, offset: 20, limit: 20 }) },
    });
    expect(screen.getByRole("heading", { name: "45 places" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Result pages" });
    expect(within(nav).getByText("Page 2 of 3")).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/search?city_id=3&adults=2",
    );
    expect(within(nav).getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/search?city_id=3&adults=2&offset=40",
    );
    expect(screen.getByTestId("pins")).toHaveTextContent("1,2");
  });

  it("shows the same listings in the same order in Persian and English (US1/AC8)", async () => {
    GET.mockResolvedValue({ data: { items: [item(5), item(2), item(9)], total: 3, limit: 20, offset: 0 } });
    const { unmount } = await show("fa", { city_id: "3" });
    const fa = screen.getAllByText(/Place/).map((e) => e.textContent);
    expect(screen.getByRole("heading", { name: "۳ اقامتگاه" })).toBeInTheDocument();
    unmount();
    await show("en", { city_id: "3" });
    expect(screen.getAllByText(/Place/).map((e) => e.textContent)).toEqual(fa);
  });

  it("explains an empty result", async () => {
    GET.mockResolvedValue({ data: { items: [], total: 0, limit: 20, offset: 0 } });
    await show("fa", { city_id: "3" });
    expect(screen.getByText("اقامتگاهی با این شرایط پیدا نشد")).toBeInTheDocument();
  });

  it("shows the translated API error", async () => {
    GET.mockResolvedValue({ error: { error: { code: "invalid_search_area", message: "English" } } });
    await show("fa", { lat: "10", lng: "10" });
    expect(screen.getByRole("alert")).toHaveTextContent("یک شهر یا یک ناحیه روی نقشه انتخاب کنید.");
  });

  it("does not search without a place", async () => {
    await show("en", {});
    expect(GET).not.toHaveBeenCalled();
    expect(screen.getByRole("form", { name: "search form" })).toBeInTheDocument();
  });
});
