import { screen } from "@testing-library/react";
import { vi } from "vitest";
import type { components } from "@/api/schema";
import { expectAccessible, renderIn } from "@/test/render";
import { ResultCard } from "./ResultCard";

// The heart's own behaviour is tested in components/wishlist (feature 012).
vi.mock("@/hooks/useWishlist", () => ({
  useWishlist: () => ({ saved: new Set<number>(), toggle: () => {}, ready: true }),
}));
vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const base: components["schemas"]["SearchResult"] = {
  id: 12,
  title: "خانه‌ی باغ در تجریش",
  property_type: "entire_place",
  city: "Tehran",
  country_code: "IR",
  pin: { lat: 35.8, lng: 51.43 },
  distance_km: null,
  avg_rating: "4.75",
  review_count: 8,
  max_guests: 4,
  price_per_night: "50000000.00",
  cleaning_fee: "5000000.00",
  currency: "IRR",
  total_price: "155000000.00",
  cover_url: "http://localhost:9000/caravansara-media/listings/12/a.jpg",
};

describe("ResultCard (FR-017)", () => {
  it("shows rial prices as toman, the total for the stay, and the rating", () => {
    renderIn(
      "fa",
      <ResultCard result={base} nights={3} stay="check_in=2026-12-01&check_out=2026-12-04&adults=2" />,
    );
    expect(screen.getByText("۵٬۰۰۰٬۰۰۰ تومان")).toBeInTheDocument();
    expect(screen.getByText(/۱۵٬۵۰۰٬۰۰۰ تومان/)).toHaveTextContent("جمع ۳ شب");
    expect(screen.getByText("تهران")).toBeInTheDocument();
    expect(screen.getByLabelText("امتیاز ۴٫۷۵ از ۵، ۸ نظر")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/listings/12?check_in=2026-12-01&check_out=2026-12-04&adults=2",
    );
  });

  it("shows another currency with its own symbol, distance in a radius search", () => {
    renderIn(
      "en",
      <ResultCard
        result={{ ...base, currency: "EUR", price_per_night: "120.00", total_price: null, distance_km: 2.34 }}
        stay=""
      />,
    );
    expect(screen.getByText("€120.00")).toBeInTheDocument();
    expect(screen.getByText(/2\.3 km away/)).toBeInTheDocument();
    expect(screen.queryByText(/total/)).toBeNull();
  });

  it("uses a placeholder for a listing without photo or reviews, never a broken image or zero", () => {
    const { container } = renderIn(
      "en",
      <ResultCard result={{ ...base, cover_url: null, avg_rating: null, review_count: 0 }} stay="" />,
    );
    // 007: the placeholder is a warm drawing in the arch, named "No photo", not an <img> that could break.
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "No photo" }).tagName.toLowerCase()).toBe("svg");
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Rated/)).toBeNull();
  });

  // specs/007-caravansara-theme, FR-006 and FR-015
  it("puts the photo in the lower caravansara arch", () => {
    const { container } = renderIn("fa", <ResultCard result={base} stay="" />);
    expect(container.querySelector("[data-arch='soft']")).toHaveClass("arch-soft");
  });

  it("marks a guest favourite: 4.8 or more with at least 3 reviews", () => {
    renderIn("fa", <ResultCard result={{ ...base, avg_rating: "4.90", review_count: 3 }} stay="" />);
    expect(screen.getByText("انتخاب مهمان‌ها")).toBeInTheDocument();
  });

  it("gives no badge below the threshold", () => {
    renderIn("fa", <ResultCard result={base} stay="" />);
    expect(screen.queryByText("انتخاب مهمان‌ها")).toBeNull();
    expect(screen.queryByText("تازه")).toBeNull();
  });

  it("shows the place type, the country and the dates of the search", () => {
    renderIn(
      "fa",
      <ResultCard result={base} nights={3} stay="check_in=2026-12-01&check_out=2026-12-04&adults=2" />,
    );
    expect(screen.getByText("کل اقامتگاه")).toBeInTheDocument();
    expect(screen.getByText(/ایران/)).toBeInTheDocument();
    expect(screen.getByText(/۱۰ آذر/)).toBeInTheDocument();
  });

  it("keeps a long title on one line, so the card keeps its layout (edge case: long text)", () => {
    const title = "خانه‌ی باغ ".repeat(30).trim();
    renderIn("fa", <ResultCard result={{ ...base, title }} stay="" />);
    expect(screen.getByRole("heading", { name: title })).toHaveClass("line-clamp-1");
  });

  it("has a wishlist heart over the photo, outside the card's link (feature 012)", () => {
    renderIn("fa", <ResultCard result={base} stay="" />);
    const heart = screen.getByRole("button", { name: /ذخیره در علاقه‌مندی‌ها/ });
    expect(heart).toHaveAttribute("aria-pressed", "false");
    expect(heart.closest("a")).toBeNull();
  });

  it("is accessible", async () => {
    const { container } = renderIn("fa", <ResultCard result={base} nights={3} stay="" />);
    await expectAccessible(container);
  });
});
