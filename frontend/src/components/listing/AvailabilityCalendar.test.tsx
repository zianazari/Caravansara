import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { expectAccessible, renderIn } from "@/test/render";
import { addDays, daysBetween } from "@/lib/calendar";

const GET = vi.fn();
vi.mock("@/api/client", () => ({ api: { GET: (...a: unknown[]) => GET(...a) } }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/cityTime", async (original) => ({
  ...(await original<typeof import("@/lib/cityTime")>()),
  todayInZone: () => "2027-01-01",
}));

import { AvailabilityCalendar } from "./AvailabilityCalendar";
import { StayDatesProvider, useStayDates } from "./StayDates";

function Shown() {
  const { dates } = useStayDates();
  return <output data-testid="dates">{JSON.stringify(dates)}</output>;
}

function setup(locale: "en" | "fa" = "en") {
  GET.mockImplementation(async (path, { params }) => {
    if (path.endsWith("/availability"))
      return {
        data: { start: "2027-01-01", end: "2028-01-01", booked_nights: ["2027-01-10", "2027-01-11"] },
      };
    const { check_in: start, check_out: end } = params.query;
    return {
      data: {
        currency: "EUR",
        total_price: "0.00",
        nights: Array.from({ length: daysBetween(start, end) }, (_, i) => ({
          date: addDays(start, i),
          amount: "120.00",
          source: "base",
          percent: "0",
          label: null,
        })),
      },
    };
  });
  return renderIn(
    locale,
    <StayDatesProvider listingId={5} timezone="Europe/Helsinki">
      <AvailabilityCalendar city="Helsinki" listing={{ id: 5, price_per_night: "120.00", currency: "EUR" }} />
      <Shown />
    </StayDatesProvider>,
  );
}
const day = (name: RegExp) => screen.getByRole("button", { name });

describe("AvailabilityCalendar (feature 019)", () => {
  beforeEach(() => {
    GET.mockReset();
  });

  it("reads the taken nights and strikes them through", async () => {
    setup();
    await waitFor(() =>
      expect(GET).toHaveBeenCalledWith("/api/v1/listings/{listing_id}/availability", {
        params: { path: { listing_id: 5 } },
      }),
    );
    const taken = await screen.findByRole("button", { name: /10 January 2027, booked/ });
    expect(taken).toHaveClass("line-through");
    expect(taken).toBeDisabled();
    expect(screen.getByRole("grid", { name: "January 2027" })).toBeInTheDocument();
    await waitFor(() => expect(day(/· 8 January 2027$/)).toHaveAccessibleDescription("€120.00 · Base"));
  });

  it("picks a stay, lets it end the morning a booking starts, and never across it", async () => {
    setup();
    await screen.findByRole("button", { name: /10 January 2027, booked/ });
    await userEvent.click(day(/· 8 January 2027$/));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Choose check-out");
    // The 12th would cross the 10th and 11th: a click there starts a new stay instead of ending this one.
    await userEvent.click(day(/· 12 January 2027$/));
    expect(screen.getByTestId("dates")).toHaveTextContent('{"checkIn":"2027-01-12"}');
    await userEvent.click(day(/· 8 January 2027$/));
    await userEvent.click(day(/10 January 2027, booked/)); // leave that morning: allowed
    expect(screen.getByTestId("dates")).toHaveTextContent('{"checkIn":"2027-01-08","checkOut":"2027-01-10"}');
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("2 nights in Helsinki");
    await userEvent.click(screen.getByRole("button", { name: "Clear dates" }));
    expect(screen.getByTestId("dates")).toHaveTextContent("{}");
  });

  it("does not go back before this month, and is accessible", async () => {
    setup("fa");
    expect(screen.getByRole("button", { name: "ماه قبل" })).toBeDisabled();
    await waitFor(() =>
      expect(document.querySelector('[data-date="2027-01-01"]')).toHaveAccessibleDescription(/۱۲۰/),
    );
    await expectAccessible(document.body);
  });
});
