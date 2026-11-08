import { screen } from "@testing-library/react";
import { vi } from "vitest";
import type { components } from "@/api/schema";
import { expectAccessible, renderIn } from "@/test/render";
import { ResultCard } from "./ResultCard";

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
    renderIn(
      "en",
      <ResultCard result={{ ...base, cover_url: null, avg_rating: null, review_count: 0 }} stay="" />,
    );
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("No photo")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("is accessible", async () => {
    const { container } = renderIn("fa", <ResultCard result={base} nights={3} stay="" />);
    await expectAccessible(container);
  });
});
