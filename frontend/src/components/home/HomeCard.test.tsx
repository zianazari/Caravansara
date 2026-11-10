import { screen } from "@testing-library/react";
import { vi } from "vitest";
import type { components } from "@/api/schema";
import { expectAccessible, renderIn } from "@/test/render";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}));
vi.mock("@/hooks/useWishlist", () => ({
  useWishlist: () => ({ saved: new Set<number>(), toggle: () => {}, ready: true }),
}));

import { HomeCard } from "./HomeCard";

const result: components["schemas"]["SearchResult"] = {
  id: 12,
  title: "خانه‌ی باغ در تجریش",
  property_type: "entire_place",
  city: "Tehran",
  country_code: "IR",
  pin: { lat: 35.8, lng: 51.43 },
  distance_km: null,
  avg_rating: "4.90",
  review_count: 8,
  max_guests: 4,
  price_per_night: "50000000.00",
  cleaning_fee: "0.00",
  currency: "IRR",
  total_price: null,
  cover_url: "http://localhost:9000/caravansara-media/listings/12/a.jpg",
};

describe("HomeCard (feature 017)", () => {
  it("shows the type in the city, the title, the nightly price in toman and the rating", () => {
    renderIn("fa", <HomeCard result={result} />);
    expect(screen.getByRole("heading", { name: "کل اقامتگاه در تهران" })).toBeInTheDocument();
    expect(screen.getByText("خانه‌ی باغ در تجریش")).toBeInTheDocument();
    expect(screen.getByText(/۵٬۰۰۰٬۰۰۰/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /۴٫۹/ })).toBeInTheDocument();
    expect(screen.getByText("انتخاب مهمان‌ها")).toBeInTheDocument();
  });

  it("is one link to the listing, with the heart outside it", () => {
    renderIn("fa", <HomeCard result={result} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/listings/12");
    expect(screen.getByRole("button", { name: /ذخیره در علاقه‌مندی‌ها/ }).closest("a")).toBeNull();
  });

  it("says when there is no photo", () => {
    renderIn("fa", <HomeCard result={{ ...result, cover_url: null }} />);
    expect(screen.queryByRole("img", { name: "" })).toBeNull();
  });

  it("is accessible", async () => {
    renderIn("fa", <HomeCard result={result} />);
    await expectAccessible(document.body);
  });
});
