import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { expectAccessible, renderIn } from "@/test/render";

let query = "";
const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(query) }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ replace, push }),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const GET = vi.fn();
const POST = vi.fn();
const adminLogin = vi.fn();
vi.mock("@/api/adminClient", () => ({
  adminApi: { GET: (...a: unknown[]) => GET(...a), POST: (...a: unknown[]) => POST(...a) },
  adminLogin: (...a: unknown[]) => adminLogin(...a),
  adminLogout: vi.fn(),
}));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
vi.mock("next/image", () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

import { AdminLogin } from "./AdminLogin";
import { AdminQueue } from "./AdminQueue";
import { AdminReview } from "./AdminReview";

const ok = (data: unknown) => ({ data, error: undefined, response: new Response(null, { status: 200 }) });
const fail = (status: number, code: string) => ({
  data: undefined,
  error: { error: { code, message: "x" } },
  response: new Response(null, { status }),
});
const city = { id: 3, name: "Tehran", timezone: "Asia/Tehran", country: { code: "IR", name: "Iran" } };
const host = { id: 7, full_name: "Sara Host", avatar_url: null };
const item = (id: number) => ({
  id,
  title: `Listing ${id}`,
  city,
  host,
  submitted_at: "2026-11-09T08:00:00Z",
  cover_url: null,
  review_version: 2,
});
let version = 2;
const listing = () => ({
  id: 4,
  title: "Courtyard house",
  description: "Quiet.",
  property_type: "entire_place",
  city,
  neighborhood: "Niavaran",
  pin: { lat: 35.8, lng: 51.4 },
  max_guests: 4,
  pets_allowed: false,
  max_pets: 0,
  bedrooms: 2,
  beds: 3,
  bathrooms: "1.5",
  price_per_night: "12000000.00",
  cleaning_fee: "0.00",
  currency: "IRR",
  check_in_time: "14:00:00",
  check_out_time: "12:00:00",
  avg_rating: null,
  review_count: 0,
  is_active: true,
  host,
  photos: [1, 2, 3, 4, 5].map((id) => ({
    id,
    url: `http://m/${id}.jpg`,
    storage_key: "k",
    width: 8,
    height: 6,
    caption: id === 1 ? "Yard" : null,
    room_tag: null,
    sort_order: id - 1,
  })),
  amenities: [{ id: 1, name: "Essentials", amenities: [{ id: 4, name: "Wifi", icon: null }] }],
  private_location: { address: "Kooche 5, Niavaran, Tehran", latitude: 35.81, longitude: 51.41 },
  review: { status: "pending", rejection_reason: null, submitted_at: "2026-11-09T08:00:00Z" },
  review_version: version,
});
const noMap = () => Promise.reject(new Error("no map in tests"));

describe("admin panel (feature 009)", () => {
  beforeEach(() => {
    [GET, POST, adminLogin, replace, push].forEach((m) => m.mockReset());
    query = "";
    version = 2;
  });

  type QueueQuery = { params: { query: { offset: number; limit: number; sort: string } } };
  const queueOf = (total: number) =>
    GET.mockImplementation((_p: string, o: QueueQuery) =>
      Promise.resolve(ok({ items: [item(o.params.query.offset + 1)], total })),
    );

  it("lists the queue with city, host and date", async () => {
    queueOf(2);
    renderIn("fa", <AdminQueue />);
    expect(await screen.findByText("Listing 1")).toBeInTheDocument();
    expect(screen.getByText("۲ آگهی در انتظار")).toBeInTheDocument();
    expect(screen.getByText(/میزبان: Sara Host/)).toBeInTheDocument();
    expect(screen.getByText(/تهران/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "بررسی: Listing 1" })).toHaveAttribute(
      "href",
      "/admin/listings/1",
    );
    expect(GET).toHaveBeenCalledWith("/api/v1/admin/listings/pending", {
      params: { query: { limit: 20, offset: 0, sort: "oldest" } },
    });
    expect(screen.queryByRole("navigation", { name: "صفحه‌ها" })).toBeNull(); // one page: no pager
    await expectAccessible(document.body);
  });

  it("pages with numbers: page 1, the last page and up to 10 between (feature 025)", async () => {
    query = "page=25";
    queueOf(1000); // 50 pages
    renderIn("fa", <AdminQueue />);
    expect(await screen.findByText("Listing 481")).toBeInTheDocument();
    const pager = screen.getByRole("navigation", { name: "صفحه‌ها" });
    const current = within(pager).getByLabelText("صفحه‌ی ۲۵");
    expect(current).toHaveAttribute("aria-current", "page");
    const numbers = within(pager)
      .getAllByRole("link")
      .map((a) => a.textContent)
      .filter((text) => text !== "قبلی" && text !== "بعدی");
    expect(numbers).toEqual(["۱", "۲۱", "۲۲", "۲۳", "۲۴", "۲۶", "۲۷", "۲۸", "۲۹", "۳۰", "۵۰"]);
    expect(within(pager).getByRole("link", { name: "صفحه‌ی ۱" })).toHaveAttribute("href", "/admin");
    expect(within(pager).getByRole("link", { name: "صفحه‌ی ۵۰" })).toHaveAttribute("href", "/admin?page=50");
    expect(within(pager).getByRole("link", { name: "قبلی" })).toHaveAttribute("href", "/admin?page=24");
    expect(within(pager).getByRole("link", { name: "بعدی" })).toHaveAttribute("href", "/admin?page=26");
    await expectAccessible(document.body);
  });

  it("sorts newest first on request and keeps the order in the page links (feature 025)", async () => {
    queueOf(45);
    const { unmount } = renderIn("en", <AdminQueue />);
    await screen.findByText("Listing 1");
    await userEvent.selectOptions(screen.getByLabelText("Order"), "Newest first");
    expect(push).toHaveBeenCalledWith("/admin?sort=newest");
    unmount();

    query = "sort=newest&page=2";
    renderIn("en", <AdminQueue />);
    expect(await screen.findByText("Listing 21")).toBeInTheDocument();
    expect(GET).toHaveBeenLastCalledWith("/api/v1/admin/listings/pending", {
      params: { query: { limit: 20, offset: 20, sort: "newest" } },
    });
    expect(screen.getByLabelText("Order")).toHaveValue("newest");
    const pager = screen.getByRole("navigation", { name: "Pages" });
    expect(within(pager).getByRole("link", { name: "Page 3" })).toHaveAttribute(
      "href",
      "/admin?sort=newest&page=3",
    );
    expect(within(pager).getByRole("link", { name: "Page 1" })).toHaveAttribute("href", "/admin?sort=newest");
    expect(within(pager).getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/admin?sort=newest&page=3",
    );
  });

  it("moves to the new last page when the queue has shrunk past the page (feature 025)", async () => {
    query = "page=5";
    queueOf(21);
    renderIn("fa", <AdminQueue />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin?page=2"));
  });

  it("sends the admin to log in when the 15-minute session has ended", async () => {
    GET.mockResolvedValue(fail(401, "token_expired"));
    renderIn("fa", <AdminQueue />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/login?ended=1"));
  });

  it("shows everything the host wrote, the photos and the exact address", async () => {
    GET.mockResolvedValue(ok(listing()));
    renderIn("fa", <AdminReview id={4} loadMap={noMap} />);
    expect(await screen.findByRole("heading", { name: "Courtyard house" })).toBeInTheDocument();
    expect(screen.getByText("Kooche 5, Niavaran, Tehran")).toBeInTheDocument();
    expect(screen.getByText("دیدن نشانی دقیق ثبت می‌شود.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Yard" })).toBeInTheDocument();
    expect(screen.getByText(/۱٬۲۰۰٬۰۰۰/)).toBeInTheDocument(); // rial as toman
    expect(screen.getByText("وای‌فای")).toBeInTheDocument();
    await expectAccessible(document.body);
  });

  it("approves with the version seen, then goes back to the queue", async () => {
    GET.mockResolvedValue(ok(listing()));
    POST.mockResolvedValue(ok(listing()));
    renderIn("fa", <AdminReview id={4} loadMap={noMap} />);
    await userEvent.click(await screen.findByRole("button", { name: "تأیید و انتشار" }));
    expect(POST).toHaveBeenCalledWith("/api/v1/admin/listings/{listing_id}/approve", {
      params: { path: { listing_id: 4 } },
      body: { review_version: 2 },
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin"));
  });

  it("needs a reason to reject, and sends it as written", async () => {
    GET.mockResolvedValue(ok(listing()));
    POST.mockResolvedValue(ok(listing()));
    renderIn("fa", <AdminReview id={4} loadMap={noMap} />);
    await userEvent.click(await screen.findByRole("button", { name: "رد" }));
    const dialog = await screen.findByRole("dialog", { name: "رد این آگهی" });
    await userEvent.click(within(dialog).getByRole("button", { name: "رد و فرستادن دلیل" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("دلیل را بنویسید.");
    expect(POST).not.toHaveBeenCalled();
    await userEvent.type(within(dialog).getByRole("textbox"), "  The photos are blurry.  ");
    await userEvent.click(within(dialog).getByRole("button", { name: "رد و فرستادن دلیل" }));
    expect(POST).toHaveBeenCalledWith("/api/v1/admin/listings/{listing_id}/reject", {
      params: { path: { listing_id: 4 } },
      body: { review_version: 2, reason: "The photos are blurry." },
    });
  });

  it("shows the new version when the host changed the listing meanwhile (409)", async () => {
    GET.mockImplementation(() => Promise.resolve(ok(listing())));
    POST.mockImplementation(async () => {
      version = 3;
      return fail(409, "listing_changed");
    });
    renderIn("fa", <AdminReview id={4} loadMap={noMap} />);
    await userEvent.click(await screen.findByRole("button", { name: "تأیید و انتشار" }));
    expect(await screen.findByText(/میزبان همین حالا آگهی را تغییر داد/)).toBeInTheDocument();
    POST.mockResolvedValue(ok(listing()));
    await waitFor(() => expect(GET).toHaveBeenCalledTimes(2));
    await userEvent.click(screen.getByRole("button", { name: "تأیید و انتشار" }));
    expect(POST.mock.lastCall![1].body).toEqual({ review_version: 3 });
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("cannot approve a listing with fewer than 5 photos, and says why (features 010, 021)", async () => {
    GET.mockResolvedValue(ok({ ...listing(), photos: listing().photos.slice(0, 4) }));
    renderIn("fa", <AdminReview id={4} loadMap={noMap} />);
    expect(await screen.findByRole("button", { name: "تأیید و انتشار" })).toBeDisabled();
    expect(screen.getByText(/کمتر از ۵ عکس دارد/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "رد" })).toBeEnabled();
  });

  it("logs in through the panel's handler and says why a log-in failed", async () => {
    query = "ended=1";
    adminLogin.mockResolvedValueOnce(
      Response.json({ error: { code: "invalid_credentials" } }, { status: 401 }),
    );
    renderIn("fa", <AdminLogin />);
    expect(screen.getByText(/۸ ساعت پس از ورود تمام می‌شود/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("ایمیل"), "admin@example.com");
    await userEvent.type(screen.getByLabelText("رمز"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "ورود" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("ایمیل یا رمز درست نیست.");
    adminLogin.mockResolvedValueOnce(Response.json({ session_expires_in: 28800 }));
    await userEvent.click(screen.getByRole("button", { name: "ورود" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
    expect(adminLogin).toHaveBeenLastCalledWith("admin@example.com", "wrong");
    await expectAccessible(document.body);
  });
});
