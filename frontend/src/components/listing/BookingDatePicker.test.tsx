import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { addDays, daysBetween } from "@/lib/calendar";
import { expectAccessible, renderIn } from "@/test/render";

const GET = vi.fn();
let search = new URLSearchParams();
let failed = false;
let bookedNights: string[] = [];
vi.mock("@/api/client", () => ({ api: { GET: (...args: unknown[]) => GET(...args) } }));
vi.mock("next/navigation", () => ({ useSearchParams: () => search }));
vi.mock("@/lib/cityTime", async (original) => ({
  ...(await original<typeof import("@/lib/cityTime")>()),
  todayInZone: () => "2027-01-01",
}));

import { BookingDatePicker } from "./BookingDatePicker";
import { StayDatesProvider, useStayDates } from "./StayDates";

const listing = { id: 5, price_per_night: "20000000", cleaning_fee: "3000000", currency: "IRR" };
function CurrentDates() {
  const { dates } = useStayDates();
  return <output data-testid="dates">{JSON.stringify(dates)}</output>;
}
function setup(locale: "fa" | "en" = "en", countryCode = "IR") {
  return renderIn(
    locale,
    <StayDatesProvider listingId={5} timezone="Asia/Tehran">
      <BookingDatePicker listing={{ ...listing, countryCode }} />
      <CurrentDates />
    </StayDatesProvider>,
  );
}
const button = (iso: string) =>
  screen.getByRole("dialog").querySelector<HTMLButtonElement>(`[data-date="${iso}"]`)!;

beforeEach(() => {
  search = new URLSearchParams();
  failed = false;
  bookedNights = ["2027-01-12", "2027-01-13"];
  GET.mockReset();
  GET.mockImplementation(async (path, { params }) => {
    if (path.endsWith("/availability")) return { data: { booked_nights: bookedNights } };
    if (failed) return { error: { error: { code: "temporary_error" } } };
    const { check_in: start, check_out: end } = params.query;
    const nights = Array.from({ length: daysBetween(start, end) }, (_, i) => {
      const date = addDays(start, i);
      const source =
        date === "2027-01-09"
          ? "weekend"
          : date === "2027-01-10"
            ? "holiday"
            : date === "2027-01-11"
              ? "custom"
              : "base";
      return {
        date,
        source,
        amount:
          source === "weekend"
            ? "26000000"
            : source === "holiday"
              ? "40000000"
              : source === "custom"
                ? "16000000"
                : "20000000",
        percent: "0",
        label: null,
      };
    });
    const subtotal = nights.reduce((sum, n) => sum + Number(n.amount), 0);
    return {
      data: {
        listing_id: 5,
        check_in: start,
        check_out: end,
        currency: "IRR",
        base_price: "20000000",
        cleaning_fee: "3000000",
        nights,
        stay_total: String(subtotal),
        total_price: String(subtotal + 3000000),
      },
    };
  });
});

describe("priced booking calendar", () => {
  it.each(["fa", "en"] as const)(
    "marks Iranian Thursday/Friday with base prices, independently of the UI language and currency (%s)",
    async (locale) => {
      for (const country of ["IR", "NL"]) {
        const { unmount } = setup(locale, country);
        await userEvent.click(screen.getByRole("button", { name: locale === "fa" ? /تاریخ سفر/ : /^Dates/ }));
        await waitFor(() => expect(button("2027-01-07")).toHaveAttribute("data-price-source", "base"));
        for (const iso of ["2027-01-07", "2027-01-08"]) {
          expect(button(iso)).toHaveAttribute("data-price-source", "base");
          const price = button(iso).querySelector("[data-day-price]");
          expect(price).toHaveTextContent(locale === "fa" ? "۲" : "2");
          if (country === "IR") {
            expect(price).toHaveClass("text-primary");
            expect(button(iso)).toHaveAccessibleDescription(/Weekend|آخر هفته/);
          } else {
            expect(price).not.toHaveClass("text-primary");
            expect(button(iso)).not.toHaveAttribute("data-weekend");
          }
        }
        expect(button("2027-01-06").querySelector("[data-day-price]")).not.toHaveClass("text-primary");
        unmount();
      }
    },
  );
  it.each(["fa", "en"] as const)(
    "shows server prices, blocked nights and checkout without a nightly charge (%s)",
    async (locale) => {
      setup(locale);
      await userEvent.click(screen.getByRole("button", { name: locale === "fa" ? /تاریخ سفر/ : /^Dates/ }));
      await waitFor(() => expect(button("2027-01-09")).toHaveAccessibleDescription(/2,600,000|۲٬۶۰۰٬۰۰۰/));
      expect(button("2027-01-09").querySelector("[data-day-price]")).toHaveTextContent(
        locale === "fa" ? "۲٫۶" : "2.6",
      );
      expect(button("2027-01-10")).toHaveAttribute("data-price-source", "holiday");
      expect(button("2027-01-11")).toHaveAttribute("data-price-source", "custom");
      expect(button("2027-01-12")).toBeDisabled();
      expect(button("2027-01-12").querySelector("[data-day-price]")).toHaveTextContent("—");
      await userEvent.click(button("2027-01-08"));
      expect(button("2027-01-12")).toBeEnabled(); // leaving that morning is allowed
      await userEvent.click(button("2027-01-12"));
      const summary = screen.getByRole("region", { name: locale === "fa" ? "خلاصهٔ اقامت" : "Stay summary" });
      await within(summary).findByText(locale === "fa" ? "۱۰٬۵۰۰٬۰۰۰ تومان" : "10,500,000 Toman");
      expect(button("2027-01-12").querySelector("[data-day-price]")).toHaveTextContent(
        locale === "fa" ? "خروج" : "Check-out",
      );
      expect(screen.getByTestId("dates")).toHaveTextContent("{}");
      await userEvent.click(
        screen.getByRole("button", { name: locale === "fa" ? "تأیید تاریخ‌ها" : "Confirm dates" }),
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByTestId("dates")).toHaveTextContent(
        '{"checkIn":"2027-01-08","checkOut":"2027-01-12"}',
      );
    },
  );

  it("discards unconfirmed edits, and can explicitly clear a previously selected stay", async () => {
    search = new URLSearchParams("check_in=2027-01-08&check_out=2027-01-10");
    setup();
    await userEvent.click(screen.getByRole("button", { name: /^Dates/ }));
    await userEvent.click(button("2027-01-15"));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByTestId("dates")).toHaveTextContent('"checkIn":"2027-01-08"');
    await userEvent.click(screen.getByRole("button", { name: /^Dates/ }));
    await userEvent.click(screen.getByRole("button", { name: "Clear dates" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm dates" }));
    expect(screen.getByTestId("dates")).toHaveTextContent("{}");
  });

  it("shows a recoverable price error without inventing amounts or enabling confirmation", async () => {
    failed = true;
    setup();
    await userEvent.click(screen.getByRole("button", { name: /^Dates/ }));
    await screen.findByRole("alert");
    expect(button("2027-01-08").querySelector("[data-day-price]")).toHaveTextContent("—");
    await userEvent.click(button("2027-01-08"));
    await userEvent.click(button("2027-01-10"));
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
    expect(screen.getByRole("button", { name: "Confirm dates" })).toBeDisabled();
    failed = false;
    for (const retry of screen.getAllByRole("button", { name: "Refresh price" }))
      await userEvent.click(retry);
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirm dates" })).toBeEnabled());
  });

  it("supports keyboard month changes, exact accessible price descriptions and axe checks", async () => {
    bookedNights.push("2027-01-01");
    setup("fa");
    await userEvent.click(screen.getByRole("button", { name: /تاریخ سفر/ }));
    await waitFor(() => expect(button("2027-01-02")).toHaveAccessibleDescription(/۲٬۰۰۰٬۰۰۰/));
    expect(button("2027-01-01")).toBeDisabled();
    expect(button("2027-01-02")).toHaveAttribute("tabindex", "0");
    act(() => button("2027-01-11").focus());
    fireEvent.keyDown(button("2027-01-11"), { key: "ArrowLeft" });
    await waitFor(() => expect(button("2027-01-14")).toHaveFocus());
    fireEvent.keyDown(button("2027-01-14"), { key: "PageDown" });
    await waitFor(() => expect(screen.getByRole("grid")).toHaveAccessibleName("بهمن ۱۴۰۵"));
    await expectAccessible(document.body);
  });
});
