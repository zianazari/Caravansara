import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { expectAccessible, renderIn } from "@/test/render";
import { hostListing } from "./fixtures";

const GET = vi.fn();
vi.mock("@/api/client", () => ({ api: { GET: (...a: unknown[]) => GET(...a) } }));
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

import { HostListings } from "./HostListings";

const summary = (id: number, status: string, is_active = true, reason: string | null = null) => ({
  id,
  title: `آگهی ${id}`,
  city: hostListing().city,
  price_per_night: "1200000.00",
  currency: "IRR",
  avg_rating: null,
  review_count: 0,
  is_active,
  cover_url: `http://m/${id}.jpg`,
  review: { status, rejection_reason: reason, submitted_at: null },
  photo_count: 3,
});

function serve(items: ReturnType<typeof summary>[], total = items.length, fewFor: number[] = []) {
  // Since feature 015 the summary has photo_count; the cards ask for nothing else.
  const counted = items.map((item) => ({ ...item, photo_count: fewFor.includes(item.id) ? 1 : 3 }));
  GET.mockImplementation((path: string, opts: { params: { query?: { offset?: number } } }) => {
    if (path !== "/api/v1/me/listings") throw new Error(`unexpected request ${path}`);
    const offset = opts.params.query?.offset ?? 0;
    return Promise.resolve({ data: { items: offset ? [summary(99, "approved")] : counted, total } });
  });
}

describe("HostListings (specs/008-host-pages, US3)", () => {
  beforeEach(() => {
    GET.mockReset();
  });

  it("shows each listing with cover, title, city, price and a status in words and icon", async () => {
    serve([
      summary(1, "pending"),
      summary(2, "approved"),
      summary(3, "approved", false),
      summary(4, "rejected"),
    ]);
    renderIn("fa", <HostListings />);
    const cards = await screen.findAllByRole("article");
    expect(cards).toHaveLength(4);
    expect(within(cards[0]!).getByText("در انتظار تأیید")).toBeInTheDocument();
    expect(within(cards[0]!).getByText("در انتظار تأیید").querySelector("svg")).not.toBeNull();
    expect(within(cards[1]!).getByText("فعال")).toBeInTheDocument();
    expect(within(cards[2]!).getByText("غیرفعال")).toBeInTheDocument();
    expect(within(cards[3]!).getByText("رد شده")).toBeInTheDocument();
    expect(within(cards[1]!).getByText(/۱۲۰٬۰۰۰/)).toBeInTheDocument(); // rial shown as toman
    expect(within(cards[1]!).getAllByRole("link", { name: "آگهی 2" })[0]).toHaveAttribute(
      "href",
      "/host/listings/2",
    );
  });

  it("marks a listing with fewer than three photos and links to its photos", async () => {
    serve([summary(1, "pending"), summary(2, "approved")], 2, [1]);
    renderIn("fa", <HostListings />);
    const link = await screen.findByRole("link", { name: "تکمیل عکس‌ها" });
    expect(link).toHaveAttribute("href", "/host/listings/1?tab=photos");
    expect(screen.getAllByText("عکس‌ها کامل نیست")).toHaveLength(1);
  });

  it("invites a user without listings to make the first", async () => {
    serve([]);
    renderIn("fa", <HostListings />);
    expect(await screen.findByRole("link", { name: "ساخت اولین آگهی" })).toHaveAttribute("href", "/host/new");
  });

  it("loads more a page at a time", async () => {
    serve([summary(1, "approved")], 2);
    renderIn("fa", <HostListings />);
    await userEvent.click(await screen.findByRole("button", { name: "آگهی‌های بیشتر" }));
    expect(await screen.findByText("آگهی 99")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "آگهی‌های بیشتر" })).toBeNull();
  });

  it("is accessible", async () => {
    serve([summary(1, "approved")]);
    renderIn("fa", <HostListings />);
    await screen.findAllByRole("article");
    await expectAccessible(document.body);
  });
});
