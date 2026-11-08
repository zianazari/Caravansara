import { screen } from "@testing-library/react";
import { renderIn } from "@/test/render";
import { PriceBreakdown } from "./PriceBreakdown";

describe("PriceBreakdown (FR-023)", () => {
  it("shows nights × price, cleaning and total in toman", () => {
    renderIn(
      "fa",
      <PriceBreakdown
        pricePerNight="50000000.00"
        cleaningFee="5000000.00"
        currency="IRR"
        checkIn="2026-12-01"
        checkOut="2026-12-04"
      />,
    );
    expect(screen.getByText("۵٬۰۰۰٬۰۰۰ تومان × ۳ شب")).toBeInTheDocument();
    expect(screen.getByText("۱۵٬۰۰۰٬۰۰۰ تومان")).toBeInTheDocument();
    expect(screen.getByText("۱۵٬۵۰۰٬۰۰۰ تومان")).toBeInTheDocument();
  });

  it("shows other currencies with their decimals", () => {
    renderIn(
      "en",
      <PriceBreakdown
        pricePerNight="99.50"
        cleaningFee="20.00"
        currency="EUR"
        checkIn="2026-12-01"
        checkOut="2026-12-03"
      />,
    );
    expect(screen.getByText("€219.00")).toBeInTheDocument();
  });
});
