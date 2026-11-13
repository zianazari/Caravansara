import { act, screen, waitFor, within } from "@testing-library/react";
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
  Link: ({
    href,
    children,
    scroll: _scroll,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    scroll?: boolean;
  }) => {
    void _scroll;
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));
const GET = vi.fn();
vi.mock("@/api/adminClient", () => ({ adminApi: { GET: (...a: unknown[]) => GET(...a) } }));
vi.mock("next/image", () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}));

import { AdminPanel } from "./AdminPanel";
import { adminHref, parseTab } from "./adminHref";

const ok = (data: unknown) => ({ data, error: undefined, response: new Response(null, { status: 200 }) });
const summary = {
  pending_listings: 3,
  users: 1250,
  bookings: { pending: 2, confirmed: 30, completed: 2317, cancelled: 5, expired: 1 },
};
const booking = (id: number, status: string) => ({
  id,
  status,
  listing: {
    id: 9,
    title: `Place ${id}`,
    city: "Tehran",
    country_code: "IR",
    timezone: "Asia/Tehran",
    cover_url: null,
  },
  guest_id: 4,
  host_id: 5,
  check_in: "2026-12-01",
  check_out: "2026-12-04",
  nights: 3,
  adults: 2,
  children: 0,
  infants: 0,
  pets: 0,
  nightly_price: "10000000.00",
  cleaning_fee: "0.00",
  total_price: "30000000.00",
  currency: "IRR",
  hold_expires_at: null,
  created_at: "2026-11-10T08:00:00Z",
  paid_at: null,
  address: null,
  guest_name: "Omid Guest",
  guest_email: "omid@example.com",
});
const user = (id: number, kind = "member") => ({
  id,
  email: `user${id}@example.com`,
  full_name: `User ${id}`,
  kind,
  created_at: "2026-10-01T08:00:00Z",
  disabled_at: null,
});

type Opts = { params?: { query?: Record<string, unknown> } };
function api(lists: { bookings?: unknown[]; users?: unknown[]; total?: number; hasMore?: boolean } = {}) {
  GET.mockImplementation((path: string) => {
    if (path === "/api/v1/admin/summary") return Promise.resolve(ok(summary));
    if (path === "/api/v1/admin/bookings")
      return Promise.resolve(ok({ items: lists.bookings ?? [], has_more: lists.hasMore ?? false }));
    if (path === "/api/v1/admin/users")
      return Promise.resolve(
        ok({ items: lists.users ?? [], total: lists.total ?? (lists.users ?? []).length }),
      );
    return Promise.resolve(ok({ items: [], total: 0 }));
  });
}
const callsTo = (path: string) =>
  GET.mock.calls.filter((c) => c[0] === path).map((c) => (c[1] as Opts)?.params?.query);

describe("admin panel tabs (feature 051)", () => {
  beforeEach(() => {
    [GET, replace, push].forEach((m) => m.mockReset());
    query = "";
  });

  it("keeps the tab, filter and page in the address, defaults left out", () => {
    expect(adminHref("queue")).toBe("/admin");
    expect(adminHref("bookings", { status: "pending", page: 1 })).toBe("/admin?tab=bookings&status=pending");
    expect(adminHref("users", { q: "ali", page: 3 })).toBe("/admin?tab=users&q=ali&page=3");
    expect(parseTab("users")).toBe("users");
    expect(parseTab("nonsense")).toBe("queue");
  });

  it("shows three tabs with their numbers and opens the queue first", async () => {
    api();
    renderIn("fa", <AdminPanel />);
    const tabs = screen.getByRole("tablist");
    expect(await within(tabs).findByText("۳")).toBeInTheDocument(); // the queue
    expect(within(tabs).getByText("۲٬۳۵۵")).toBeInTheDocument(); // every booking
    expect(within(tabs).getByText("۱٬۲۵۰")).toBeInTheDocument(); // every account
    expect(screen.getByRole("tab", { name: /صف بازبینی/, selected: true })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /رزروها/ }));
    expect(push).toHaveBeenCalledWith("/admin?tab=bookings");
    await expectAccessible(document.body);
  });

  it("lists bookings by status with the guest, the stay and the total, in pages", async () => {
    query = "tab=bookings&status=pending&page=1";
    api({ bookings: [booking(41, "pending")], hasMore: false });
    renderIn("fa", <AdminPanel />);
    expect(await screen.findByText("Place 41")).toBeInTheDocument();
    const row = screen.getByText("Place 41").closest("tr")!;
    expect(within(row).getByText("Omid Guest")).toBeInTheDocument();
    expect(within(row).getByText("omid@example.com")).toBeInTheDocument();
    expect(within(row).getByText("پرداخت‌نشده")).toBeInTheDocument();
    expect(within(row).getByText("۳ شب")).toBeInTheDocument();
    expect(within(row).getByText(/۳ میلیون تومان|۳٬۰۰۰٬۰۰۰ تومان/)).toBeInTheDocument();
    expect(callsTo("/api/v1/admin/bookings")[0]).toEqual({ limit: 20, offset: 0, status: "pending" });
    const filter = screen.getByRole("navigation", { name: "وضعیت رزرو" });
    expect(within(filter).getByRole("link", { name: /پرداخت‌نشده/ })).toHaveAttribute("aria-current", "page");
    expect(within(filter).getByRole("link", { name: /انجام‌شده/ })).toHaveAttribute(
      "href",
      "/admin?tab=bookings&status=completed",
    );
    await expectAccessible(document.body);
  });

  it("numbers the bookings pages from the status count", async () => {
    query = "tab=bookings&status=completed&page=2";
    api({ bookings: [booking(7, "completed")], hasMore: true });
    renderIn("fa", <AdminPanel />);
    // Before the numbers arrive the pager knows only that a next page exists; then 2317 completed, 20 a page: 116.
    expect(await screen.findByRole("link", { name: "صفحه‌ی ۱۱۶" })).toHaveAttribute(
      "href",
      "/admin?tab=bookings&status=completed&page=116",
    );
    expect(callsTo("/api/v1/admin/bookings")[0]).toEqual({ limit: 20, offset: 20, status: "completed" });
  });

  it("lists users and searches only from 3 letters, a moment after typing stops", async () => {
    query = "tab=users";
    api({ users: [user(2), user(1, "admin")] });
    renderIn("fa", <AdminPanel />);
    expect(await screen.findByText("User 2")).toBeInTheDocument();
    expect(screen.getByText("مدیر")).toBeInTheDocument();
    expect(screen.getByText("۲ کاربر")).toBeInTheDocument();
    const box = screen.getByLabelText("جستجوی نام یا ایمیل");
    await userEvent.type(box, "al");
    expect(screen.getByText("دست‌کم ۳ حرف بنویسید.")).toBeInTheDocument();
    await act(() => new Promise((r) => setTimeout(r, 450)));
    expect(replace).not.toHaveBeenCalled();
    await userEvent.type(box, "i");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin?tab=users&q=ali"));
    await expectAccessible(document.body);
  });

  it("sorts bookings through the API and keeps the status and order across pages", async () => {
    query = "tab=bookings&status=completed&page=2&sort_by=total_price&order=asc";
    api({ bookings: [booking(7, "completed")], hasMore: true });
    renderIn("en", <AdminPanel />);
    expect(await screen.findByText("Place 7")).toBeInTheDocument();
    expect(callsTo("/api/v1/admin/bookings")[0]).toEqual({
      limit: 20,
      offset: 20,
      status: "completed",
      sort_by: "total_price",
      order: "asc",
    });
    const amount = screen.getByRole("columnheader", { name: /Total/ });
    expect(amount).toHaveAttribute("aria-sort", "ascending");
    expect(within(amount).getByRole("link")).toHaveAttribute(
      "href",
      "/admin?tab=bookings&status=completed&sort_by=total_price&order=desc",
    );
    expect(await screen.findByRole("link", { name: "Page 116" })).toHaveAttribute(
      "href",
      "/admin?tab=bookings&status=completed&sort_by=total_price&order=asc&page=116",
    );
    const filter = screen.getByRole("navigation", { name: "Booking status" });
    expect(within(filter).getByRole("link", { name: /Confirmed/ })).toHaveAttribute(
      "href",
      "/admin?tab=bookings&status=confirmed&sort_by=total_price&order=asc",
    );
    expect(screen.getAllByRole("columnheader")).toHaveLength(7);
    await expectAccessible(document.body);
  });

  it("keeps the user search when sorting and preserves the order when searching or paging", async () => {
    query = "tab=users&q=user&page=2&sort_by=full_name&order=desc";
    api({ users: [user(21)], total: 45 });
    renderIn("en", <AdminPanel />);
    expect(await screen.findByText("User 21")).toBeInTheDocument();
    expect(callsTo("/api/v1/admin/users")[0]).toEqual({
      limit: 20,
      offset: 20,
      q: "user",
      sort_by: "full_name",
      order: "desc",
    });
    const name = screen.getByRole("columnheader", { name: /Name/ });
    expect(name).toHaveAttribute("aria-sort", "descending");
    expect(within(name).getByRole("link")).toHaveAttribute(
      "href",
      "/admin?tab=users&q=user&sort_by=full_name&order=asc",
    );
    expect(screen.getByRole("link", { name: "Page 3" })).toHaveAttribute(
      "href",
      "/admin?tab=users&q=user&sort_by=full_name&order=desc&page=3",
    );
    expect(screen.getAllByRole("columnheader")).toHaveLength(4);
    await userEvent.type(screen.getByRole("searchbox"), "z");
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/admin?tab=users&q=userz&sort_by=full_name&order=desc"),
    );
  });
});
