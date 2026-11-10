import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { expectAccessible, renderIn } from "@/test/render";

const GET = vi.fn();
vi.mock("@/api/client", () => ({ api: { GET: (...a: unknown[]) => GET(...a) } }));

import { HostBookings } from "./HostBookings";

const booking = (id: number, status: string, check_in: string, check_out: string) => ({
  id,
  status,
  listing: { id: 5, title: "x", city: "Tehran", timezone: "Asia/Tehran", cover_url: null },
  guest_id: 2,
  host_id: 1,
  check_in,
  check_out,
  nights: 2,
  adults: 2,
  children: 1,
  infants: 0,
  pets: 0,
  nightly_price: "1000000.00",
  cleaning_fee: "0.00",
  total_price: "2000000.00",
  currency: "IRR",
  hold_expires_at: null,
  created_at: "2026-01-01T00:00:00Z",
  address: null,
});

function serve(items: ReturnType<typeof booking>[], total = items.length) {
  GET.mockImplementation((_p: string, o: { params: { query: { offset: number } } }) =>
    Promise.resolve({
      data: o.params.query.offset
        ? { items: [booking(9, "completed", "2020-01-01", "2020-01-03")], total }
        : { items, total },
    }),
  );
}

describe("HostBookings (specs/008-host-pages, US4)", () => {
  beforeEach(() => {
    GET.mockReset();
  });

  it("shows upcoming first, then past, with guests, status and toman", async () => {
    serve([
      booking(1, "cancelled", "2025-03-01", "2025-03-03"),
      booking(2, "confirmed", "2099-05-01", "2099-05-03"),
    ]);
    renderIn("fa", <HostBookings listingId={5} />);
    const upcoming = await screen.findByRole("region", { name: "پیش رو" });
    const past = screen.getByRole("region", { name: "گذشته" });
    expect(upcoming.compareDocumentPosition(past) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(upcoming).getByText(/قطعی/)).toBeInTheDocument();
    expect(within(past).getByText(/لغوشده/)).toBeInTheDocument();
    expect(within(upcoming).getByText("۳ مهمان")).toBeInTheDocument();
    expect(within(upcoming).getByText(/۲۰۰٬۰۰۰/)).toBeInTheDocument();
    expect(GET).toHaveBeenCalledWith("/api/v1/listings/{listing_id}/bookings", {
      params: { path: { listing_id: 5 }, query: { limit: 20, offset: 0 } },
    });
  });

  it("writes dates in the Persian calendar in Persian and the Gregorian in English", async () => {
    serve([booking(2, "confirmed", "2099-05-01", "2099-05-03")]);
    const fa = renderIn("fa", <HostBookings listingId={5} />);
    expect(await screen.findByText(/اردیبهشت/)).toBeInTheDocument();
    fa.unmount();
    renderIn("en", <HostBookings listingId={5} />);
    expect(await screen.findByText(/1 May 2099/)).toBeInTheDocument();
  });

  it("pages, and says when there is none", async () => {
    serve([booking(2, "pending", "2099-05-01", "2099-05-03")], 2);
    const view = renderIn("fa", <HostBookings listingId={5} />);
    await userEvent.click(await screen.findByRole("button", { name: "رزروهای بیشتر" }));
    expect(await screen.findByText(/انجام‌شده/)).toBeInTheDocument();
    view.unmount();
    serve([]);
    renderIn("fa", <HostBookings listingId={5} />);
    expect(await screen.findByText("هنوز رزروی برای این آگهی نیست.")).toBeInTheDocument();
  });

  it("is accessible", async () => {
    serve([booking(2, "confirmed", "2099-05-01", "2099-05-03")]);
    renderIn("fa", <HostBookings listingId={5} />);
    await screen.findByRole("region", { name: "پیش رو" });
    await expectAccessible(document.body);
  });
});
