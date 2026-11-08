import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { expectAccessible, renderIn } from "@/test/render";

const GET = vi.fn();
const POST = vi.fn();
const push = vi.fn();
vi.mock("@/api/client", () => ({
  api: { GET: (...a: unknown[]) => GET(...a), POST: (...a: unknown[]) => POST(...a) },
  serverSkewMs: () => 0,
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push }),
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

import { CancelDialog } from "./CancelDialog";
import { ReviewForm } from "./ReviewForm";
import { TripList } from "./TripList";

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const listing = {
  id: 5,
  title: "Canal flat",
  city: "Amsterdam",
  country_code: "NL",
  timezone: "Europe/Amsterdam",
  cover_url: null,
};
const trip = (id: number, status: string, checkIn: number, checkOut: number) => ({
  id,
  status,
  listing: { ...listing, title: `Trip ${id}` },
  guest_id: 9,
  host_id: 3,
  check_in: day(checkIn),
  check_out: day(checkOut),
  nights: checkOut - checkIn,
  adults: 2,
  children: 0,
  infants: 0,
  pets: 0,
  nightly_price: "100.00",
  cleaning_fee: "0.00",
  total_price: "300.00",
  currency: "EUR",
  hold_expires_at: null,
  created_at: "2026-01-01T00:00:00Z",
  address: null,
});

beforeEach(() => [GET, POST, push].forEach((m) => m.mockReset()));

describe("TripList (FR-029, US4/AC1, AC5)", () => {
  it("splits trips into upcoming and past, with status, dates and total", async () => {
    GET.mockResolvedValue({
      data: {
        items: [
          trip(1, "confirmed", 10, 13),
          trip(2, "completed", -20, -17),
          trip(3, "cancelled", 30, 32),
          trip(4, "completed", -5, -3),
        ],
        total: 4,
      },
    });
    renderIn("en", <TripList />);
    const upcoming = await screen.findByRole("region", { name: "Upcoming" });
    expect(within(upcoming).getByText("Trip 1")).toBeInTheDocument();
    const past = screen.getByRole("region", { name: "Past" });
    expect(within(past).getByText("Trip 2")).toBeInTheDocument();
    expect(within(past).getByText("Trip 3")).toBeInTheDocument();
    expect(within(upcoming).getByText("Confirmed").parentElement).toHaveTextContent("Confirmed · €300.00");
    // only the stay that ended 3 days ago can still be reviewed
    expect(within(past).getAllByRole("link", { name: "Write a review" })).toHaveLength(1);
    expect(within(past).getByRole("link", { name: "Write a review" })).toHaveAttribute(
      "href",
      "/trips/4/review",
    );
  });

  it("shows dates in the Jalali calendar on Persian pages", async () => {
    GET.mockResolvedValue({
      data: {
        items: [{ ...trip(1, "confirmed", 10, 13), check_in: "2027-03-21", check_out: "2027-03-24" }],
        total: 1,
      },
    });
    renderIn("fa", <TripList />);
    expect(await screen.findByText(/۱ فروردین ۱۴۰۶/)).toBeInTheDocument();
  });

  it("leads to the search when there are no trips", async () => {
    GET.mockResolvedValue({ data: { items: [], total: 0 } });
    renderIn("fa", <TripList />);
    expect(await screen.findByText("هنوز سفری رزرو نکرده‌اید.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "جستجوی اقامتگاه" })).toHaveAttribute("href", "/");
  });

  it("is accessible", async () => {
    GET.mockResolvedValue({ data: { items: [trip(1, "confirmed", 10, 13)], total: 1 } });
    const { container } = renderIn("fa", <TripList />);
    await screen.findByText("Trip 1");
    await expectAccessible(container);
  });
});

describe("CancelDialog (FR-030, US4/AC2 to AC4)", () => {
  it("cancels after a second confirmation that says there is no fee or refund", async () => {
    POST.mockResolvedValue({ data: trip(1, "cancelled", 10, 13) });
    renderIn("en", <CancelDialog booking={trip(1, "confirmed", 10, 13) as never} />);
    expect(screen.getByText(/You can cancel until the end of .* Amsterdam time\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel booking" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("There is no fee and no refund in this version");
    await userEvent.click(screen.getByRole("button", { name: "Yes, cancel" }));
    expect(POST).toHaveBeenCalledWith("/api/v1/bookings/{booking_id}/cancel", {
      params: { path: { booking_id: 1 } },
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("is not offered on or after the check-in day, or for a finished booking", () => {
    const { container } = renderIn("en", <CancelDialog booking={trip(1, "confirmed", 0, 3) as never} />);
    expect(container).toBeEmptyDOMElement();
    const done = renderIn("en", <CancelDialog booking={trip(2, "cancelled", 10, 13) as never} />);
    expect(done.container).toBeEmptyDOMElement();
  });

  it("explains in plain words when the booking changed meanwhile", async () => {
    POST.mockResolvedValue({ error: { error: { code: "invalid_booking_state" } } });
    renderIn("fa", <CancelDialog booking={trip(1, "confirmed", 10, 13) as never} />);
    await userEvent.click(screen.getByRole("button", { name: "لغو رزرو" }));
    await userEvent.click(screen.getByRole("button", { name: "بله، لغو شود" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("این رزرو دیگر لغوشدنی نیست.");
  });
});

describe("ReviewForm (FR-031, US5)", () => {
  it("posts the overall rating, the chosen details and the text, then opens the listing (US5/AC1)", async () => {
    GET.mockResolvedValue({ data: trip(4, "completed", -5, -3) });
    POST.mockResolvedValue({ data: { id: 1 } });
    renderIn("en", <ReviewForm bookingId={4} />);
    const overall = await screen.findByRole("group", { name: "Overall rating" });
    await userEvent.click(within(overall).getByRole("radio", { name: "5 stars" }));
    await userEvent.click(
      within(screen.getByRole("group", { name: "Cleanliness" })).getByRole("radio", { name: "4 stars" }),
    );
    await userEvent.type(screen.getByLabelText("Your review"), "  Lovely and quiet. ");
    await userEvent.click(screen.getByRole("button", { name: "Post review" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/listings/5"));
    expect(POST).toHaveBeenCalledWith("/api/v1/bookings/{booking_id}/review", {
      params: { path: { booking_id: 4 } },
      body: { rating: 5, cleanliness_rating: 4, comment: "Lovely and quiet." },
    });
  });

  it("marks what is missing and sends nothing (US5/AC3)", async () => {
    GET.mockResolvedValue({ data: trip(4, "completed", -5, -3) });
    renderIn("fa", <ReviewForm bookingId={4} />);
    await userEvent.click(await screen.findByRole("button", { name: "ثبت نظر" }));
    expect(screen.getByText("امتیاز کلی را انتخاب کنید.")).toBeInTheDocument();
    expect(screen.getByText("متن نظر را بنویسید.")).toBeInTheDocument();
    expect(POST).not.toHaveBeenCalled();
  });

  it("explains a second review or a closed window (US5/AC2)", async () => {
    GET.mockResolvedValue({ data: trip(4, "completed", -5, -3) });
    POST.mockResolvedValue({ error: { error: { code: "already_reviewed" } } });
    renderIn("en", <ReviewForm bookingId={4} />);
    await userEvent.click(
      within(await screen.findByRole("group", { name: "Overall rating" })).getByRole("radio", {
        name: "3 stars",
      }),
    );
    await userEvent.type(screen.getByLabelText("Your review"), "Fine.");
    await userEvent.click(screen.getByRole("button", { name: "Post review" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You have already reviewed this stay.");
  });

  it("is not offered for a stay that ended more than 14 days ago", async () => {
    GET.mockResolvedValue({ data: trip(2, "completed", -20, -17) });
    renderIn("en", <ReviewForm bookingId={2} />);
    expect(await screen.findByRole("status")).toHaveTextContent("This stay cannot be reviewed.");
  });

  it("is accessible", async () => {
    GET.mockResolvedValue({ data: trip(4, "completed", -5, -3) });
    const { container } = renderIn("fa", <ReviewForm bookingId={4} />);
    await screen.findByRole("group", { name: "امتیاز کلی" });
    await expectAccessible(container);
  });
});
