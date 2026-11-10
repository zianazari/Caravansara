import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { draftFor, readDraft } from "@/lib/bookingDraft";
import { expectAccessible, renderIn } from "@/test/render";

const GET = vi.fn();
const POST = vi.fn();
const push = vi.fn();
const replace = vi.fn();
let me: { id: number } | undefined;
let skew = 0;
vi.mock("@/api/client", () => ({
  api: { GET: (...a: unknown[]) => GET(...a), POST: (...a: unknown[]) => POST(...a) },
  serverSkewMs: () => skew,
}));
vi.mock("@/hooks/useAuth", () => ({ useMe: () => ({ data: me }) }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push, replace }),
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({ useSearchParams: () => search }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
// The booked place's photos are tested in TripListing.test.tsx; here only the booking itself.
vi.mock("./TripListing", () => ({ TripListing: () => null }));

import { BookingBox } from "@/components/listing/BookingBox";
import { StayDatesProvider } from "@/components/listing/StayDates";
import { ConfirmBooking } from "./ConfirmBooking";
import { TripDetail } from "./TripDetail";

const listing = {
  id: 5,
  host_id: 3,
  price_per_night: "120.00",
  cleaning_fee: "30.00",
  currency: "EUR",
  max_guests: 2,
  pets_allowed: false,
  max_pets: 0,
  timezone: "Europe/Amsterdam",
};
/** The booking box shares its dates with the page's calendar (feature 019). */
const Box = () => (
  <StayDatesProvider listingId={5} timezone="Europe/Amsterdam">
    <BookingBox listing={listing} />
  </StayDatesProvider>
);
const stay = {
  listing_id: 5,
  check_in: "2027-01-10",
  check_out: "2027-01-13",
  adults: 2,
  children: 0,
  infants: 0,
  pets: 0,
};
const bookingListing = {
  id: 5,
  title: "Canal flat",
  city: "Amsterdam",
  country_code: "NL",
  timezone: "Europe/Amsterdam",
  cover_url: null,
};
const booking = (over: Record<string, unknown> = {}) => ({
  id: 77,
  status: "pending",
  listing: bookingListing,
  guest_id: 9,
  host_id: 3,
  check_in: "2027-01-10",
  check_out: "2027-01-13",
  nights: 3,
  adults: 2,
  children: 0,
  infants: 0,
  pets: 0,
  nightly_price: "120.00",
  cleaning_fee: "30.00",
  total_price: "390.00",
  currency: "EUR",
  hold_expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
  created_at: "2026-11-08T12:00:00Z",
  address: null,
  ...over,
});

beforeEach(() => {
  [GET, POST, push, replace].forEach((m) => m.mockReset());
  sessionStorage.clear();
  me = { id: 9 };
  skew = 0;
  search = new URLSearchParams("check_in=2027-01-10&check_out=2027-01-13&adults=2");
});

describe("BookingBox (US3, FR-023, FR-024)", () => {
  it("shows the total from the search's dates and saves a draft before going to book", async () => {
    renderIn("en", <Box />);
    expect(screen.getByText("€390.00")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reserve" }));
    expect(push).toHaveBeenCalledWith("/book/5");
    expect(readDraft()).toMatchObject(stay);
  });

  it("stops more guests than the place allows before asking the API (US3/AC6)", async () => {
    search = new URLSearchParams("check_in=2027-01-10&check_out=2027-01-13&adults=3");
    renderIn("fa", <Box />);
    await userEvent.click(screen.getByRole("button", { name: "رزرو" }));
    expect(screen.getByRole("alert")).toHaveTextContent("تعداد مهمان‌ها از ظرفیت این اقامتگاه بیشتر است.");
    expect(push).not.toHaveBeenCalled();
  });

  it("refuses dates that cross a taken night before going to book (feature 019)", async () => {
    search = new URLSearchParams("check_in=2027-01-10&check_out=2027-01-13&adults=2");
    GET.mockResolvedValue({
      data: { start: "2027-01-01", end: "2028-01-01", booked_nights: ["2027-01-11"] },
    });
    renderIn("en", <Box />);
    await waitFor(() => expect(GET).toHaveBeenCalled());
    await userEvent.click(screen.getByRole("button", { name: "Reserve" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/not available|taken|booked/i);
    expect(push).not.toHaveBeenCalled();
  });

  it("asks for dates first", async () => {
    search = new URLSearchParams();
    renderIn("en", <Box />);
    await userEvent.click(screen.getByRole("button", { name: "Reserve" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose check-in and check-out dates.");
  });

  it("offers no booking on the host's own listing", () => {
    me = { id: 3 };
    renderIn("en", <Box />);
    expect(screen.queryByRole("button", { name: "Reserve" })).toBeNull();
    expect(screen.getByText("This is your own place.")).toBeInTheDocument();
  });

  it("is accessible", async () => {
    const { container } = renderIn("fa", <Box />);
    await expectAccessible(container);
  });
});

describe("ConfirmBooking (US3/AC1, AC4, AC5)", () => {
  const listingOut = {
    id: 5,
    title: "Canal flat",
    price_per_night: "120.00",
    cleaning_fee: "30.00",
    currency: "EUR",
  };

  it("holds the dates with the draft's idempotency key and opens the trip", async () => {
    const draft = draftFor(stay);
    GET.mockResolvedValue({ data: listingOut });
    POST.mockResolvedValue({ data: booking() });
    renderIn("en", <ConfirmBooking listingId={5} />);
    await userEvent.click(await screen.findByRole("button", { name: "Hold these dates" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/trips/77"));
    expect(POST).toHaveBeenCalledWith("/api/v1/bookings", {
      params: { header: { "Idempotency-Key": draft.idempotency_key } },
      body: stay,
    });
    expect(readDraft()?.booking_id).toBe(77);
  });

  it("sends the same key again after a failure, so no second hold is made", async () => {
    const draft = draftFor(stay);
    GET.mockResolvedValue({ data: listingOut });
    POST.mockResolvedValueOnce({ error: { error: { code: "service_unavailable" } } }).mockResolvedValueOnce({
      data: booking(),
    });
    renderIn("en", <ConfirmBooking listingId={5} />);
    const button = await screen.findByRole("button", { name: "Hold these dates" });
    await userEvent.click(button);
    await screen.findByRole("alert");
    await userEvent.click(button);
    await waitFor(() => expect(POST).toHaveBeenCalledTimes(2));
    const keys = POST.mock.calls.map(
      (c) => (c[1] as { params: { header: Record<string, string> } }).params.header["Idempotency-Key"],
    );
    expect(keys).toEqual([draft.idempotency_key, draft.idempotency_key]);
  });

  it("says the dates were just taken and leads back to the listing (US3/AC4)", async () => {
    draftFor(stay);
    GET.mockResolvedValue({ data: listingOut });
    POST.mockResolvedValue({ error: { error: { code: "dates_unavailable", message: "x" } } });
    renderIn("fa", <ConfirmBooking listingId={5} />);
    await userEvent.click(await screen.findByRole("button", { name: "نگه داشتن تاریخ‌ها" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("این تاریخ‌ها همین الان رزرو شد.");
    expect(screen.getByRole("link", { name: "بازگشت" })).toHaveAttribute(
      "href",
      "/listings/5?check_in=2027-01-10&check_out=2027-01-13&adults=2",
    );
  });

  it("explains when there is no booking in progress", () => {
    renderIn("en", <ConfirmBooking listingId={5} />);
    expect(screen.getByRole("status")).toHaveTextContent("There is no booking in progress.");
  });
});

describe("TripDetail (US3/AC2, AC3, AC7)", () => {
  it("shows the countdown and pays a pending hold", async () => {
    GET.mockResolvedValue({ data: booking() });
    POST.mockResolvedValue({
      data: booking({
        status: "confirmed",
        hold_expires_at: null,
        address: {
          address: "Prinsengracht 7",
          latitude: 1,
          longitude: 2,
          check_in_time: "15:00:00",
          check_out_time: "11:00:00",
        },
      }),
    });
    renderIn("en", <TripDetail bookingId={77} />);
    expect(await screen.findByText(/Time left to pay: 1[45]:/)).toBeInTheDocument();
    expect(screen.getByText(/no card details are asked for/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Pay €390.00" }));
    expect(POST).toHaveBeenCalledWith("/api/v1/bookings/{booking_id}/pay", {
      params: { path: { booking_id: 77 } },
    });
    expect(await screen.findByText("Prinsengracht 7")).toBeInTheDocument();
    expect(screen.getByText("Check-in from 15:00, Amsterdam time")).toBeInTheDocument();
  });

  it("ends the hold at zero and offers to book again (US3/AC3)", async () => {
    GET.mockResolvedValue({ data: booking({ hold_expires_at: new Date(Date.now() + 1500).toISOString() }) });
    renderIn("fa", <TripDetail bookingId={77} />);
    await screen.findByRole("button", { name: /پرداخت/ });
    await act(() => new Promise((r) => setTimeout(r, 2100)));
    expect(screen.queryByRole("button", { name: /پرداخت/ })).toBeNull();
    expect(screen.getByRole("link", { name: "رزرو دوباره" })).toHaveAttribute(
      "href",
      "/listings/5?check_in=2027-01-10&check_out=2027-01-13&adults=2",
    );
  });

  it("trusts the server's hold_expired over the clock", async () => {
    GET.mockResolvedValue({ data: booking() });
    POST.mockResolvedValue({ error: { error: { code: "hold_expired" } } });
    renderIn("en", <TripDetail bookingId={77} />);
    await userEvent.click(await screen.findByRole("button", { name: /Pay/ }));
    expect(await screen.findByText("Book again")).toBeInTheDocument();
  });

  it("uses the server's clock: a hold the server sees as over cannot be paid", async () => {
    skew = 16 * 60_000; // the server is 16 minutes ahead
    GET.mockResolvedValue({ data: booking() });
    renderIn("en", <TripDetail bookingId={77} />);
    expect(await screen.findByText("Book again")).toBeInTheDocument();
  });

  it("is accessible", async () => {
    GET.mockResolvedValue({ data: booking() });
    const { container } = renderIn("fa", <TripDetail bookingId={77} />);
    await screen.findByRole("button", { name: /پرداخت/ });
    await expectAccessible(container);
  });
});
