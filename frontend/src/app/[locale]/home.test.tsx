import { screen } from "@testing-library/react";
import { vi } from "vitest";
import { expectAccessible, renderIn } from "@/test/render";

/**
 * The home page as a whole (specs/007-caravansara-theme, US1/AC1): the night hero, the search pill, the
 * categories, one row for each suggested city and the arcade band. Each part has its own tests; this one checks
 * they are all on the page, in Persian and English.
 */
const GET = vi.fn();
vi.mock("@/api/client", () => ({ api: { GET: (...args: unknown[]) => GET(...args) } }));
vi.mock("next-intl/server", async () => (await import("@/test/serverIntl")).serverIntlMock());
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}));

import { SUGGESTED } from "@/components/home/HomeRows";
import HomePage from "./page";

const cities = SUGGESTED.map((name, i) => ({
  id: i + 1,
  name,
  timezone: "UTC",
  country: { id: 1, code: "IR", name: "Iran" },
}));
const place = (id: number, city: string) => ({
  id,
  title: `Place ${id}`,
  property_type: "entire_place",
  city,
  country_code: "IR",
  pin: { lat: 35.7, lng: 51.4 },
  distance_km: null,
  avg_rating: "4.9",
  review_count: 5,
  max_guests: 2,
  price_per_night: "30000000.00",
  cleaning_fee: "0.00",
  currency: "IRR",
  total_price: null,
  cover_url: null,
});

/** Every row is "near the screen" at once. */
class SeenObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  observe() {
    this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as never);
  }
  disconnect() {}
}

describe("home page (US1/AC1)", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", SeenObserver);
    GET.mockImplementation((path: string, options?: { params?: { query?: Record<string, unknown> } }) => {
      const query = options?.params?.query ?? {};
      if (path === "/api/v1/amenities") return Promise.resolve({ data: [] });
      if (path === "/api/v1/cities")
        return Promise.resolve({ data: cities.filter((c) => c.name === query.q) });
      const city = cities.find((c) => c.id === query.city_id)!;
      return Promise.resolve({ data: { items: [place(city.id, city.name)], total: 1, limit: 8, offset: 0 } });
    });
  });

  it.each([
    ["fa", "جایی برای ماندن، در هر شهر سر راه", "جستجو", "دسته‌ها", "محبوب در تهران"],
    ["en", "A place to stay, in every city on the way", "Search", "Categories", "Popular in Tehran"],
  ] as const)(
    "in %s: hero, search pill, categories, a row per city and the arcade",
    async (locale, title, search, categories, firstRow) => {
      const page = await HomePage({ params: Promise.resolve({ locale }) });
      const { container } = renderIn(locale, page);
      expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
      expect(container.querySelector("[data-hero='doorway']")).not.toBeNull();
      expect(screen.getByRole("search")).toContainElement(screen.getByRole("button", { name: search }));
      expect(screen.getByRole("navigation", { name: categories })).toBeInTheDocument();
      expect(await screen.findByRole("heading", { name: new RegExp(firstRow) })).toBeInTheDocument();
      expect(await screen.findAllByRole("heading", { level: 2 })).toHaveLength(SUGGESTED.length);
      // The arcade band: a row of small decorative arches.
      expect(container.querySelectorAll("[aria-hidden] > .arch.bg-muted")).toHaveLength(12);
    },
  );

  it("is accessible", async () => {
    const page = await HomePage({ params: Promise.resolve({ locale: "fa" }) });
    const { container } = renderIn("fa", page);
    await screen.findAllByRole("heading", { level: 2 });
    await expectAccessible(container);
  });
});
