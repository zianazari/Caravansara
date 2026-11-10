import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { expectAccessible, renderIn } from "@/test/render";

let state: "signedIn" | "signedOut" | "checking" = "signedIn";
const push = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuthState: () => state }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/search",
  useRouter: () => ({ push }),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const GET = vi.fn();
const PUT = vi.fn();
const DELETE = vi.fn();
vi.mock("@/api/client", () => ({
  api: {
    GET: (...a: unknown[]) => GET(...a),
    PUT: (...a: unknown[]) => PUT(...a),
    DELETE: (...a: unknown[]) => DELETE(...a),
  },
}));
vi.mock("next/image", () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}));
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() } }));

import { HeartButton } from "./HeartButton";
import { WishlistView } from "./WishlistView";

const card = (id: number) => ({
  id,
  title: `Place ${id}`,
  city: { id: 1, name: "Tehran", timezone: "Asia/Tehran", country: { code: "IR", name: "Iran" } },
  price_per_night: "12000000.00",
  currency: "IRR",
  avg_rating: "4.90",
  review_count: 3,
  cover_url: null,
});

describe("wishlists (feature 012)", () => {
  beforeEach(() => {
    [GET, PUT, DELETE, push, toastError].forEach((m) => m.mockReset());
    state = "signedIn";
  });

  it("saves and removes with one tap, the heart changing at once", async () => {
    GET.mockResolvedValue({ data: { listing_ids: [] } });
    PUT.mockResolvedValue({ error: undefined });
    DELETE.mockResolvedValue({ error: undefined });
    renderIn("fa", <HeartButton listingId={4} title="Place 4" />);
    const heart = await screen.findByRole("button", { name: "ذخیره در علاقه‌مندی‌ها: Place 4" });
    expect(heart).toHaveAttribute("aria-pressed", "false");
    GET.mockResolvedValue({ data: { listing_ids: [4] } }); // what the API says after the save
    await userEvent.click(heart);
    expect(await screen.findByRole("button", { name: "برداشتن از علاقه‌مندی‌ها: Place 4" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(PUT).toHaveBeenCalledWith("/api/v1/me/wishlist/{listing_id}", {
      params: { path: { listing_id: 4 } },
    });
    await userEvent.click(screen.getByRole("button", { name: /برداشتن/ }));
    await waitFor(() => expect(DELETE).toHaveBeenCalled());
  });

  it("goes back and says why when the API refuses", async () => {
    GET.mockResolvedValue({ data: { listing_ids: [] } });
    PUT.mockResolvedValue({ error: { error: { code: "wishlist_full" } } });
    renderIn("fa", <HeartButton listingId={4} title="Place 4" />);
    await userEvent.click(await screen.findByRole("button", { name: /ذخیره/ }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("فهرست علاقه‌مندی‌ها پر است (۵۰۰ آگهی). یکی را بردارید."),
    );
    expect(screen.getByRole("button", { name: /ذخیره/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("sends a visitor to log in and back", async () => {
    state = "signedOut";
    renderIn("fa", <HeartButton listingId={4} title="Place 4" />);
    await userEvent.click(screen.getByRole("button", { name: /ذخیره/ }));
    expect(push).toHaveBeenCalledWith({ pathname: "/login", query: { returnTo: "/search" } });
    expect(PUT).not.toHaveBeenCalled();
    expect(GET).not.toHaveBeenCalled();
  });

  it("waits while the session is being restored, instead of sending a member to log in", () => {
    state = "checking";
    renderIn("fa", <HeartButton listingId={4} title="Place 4" />);
    expect(screen.getByRole("button", { name: /ذخیره/ })).toBeDisabled();
    expect(push).not.toHaveBeenCalled();
  });

  it("lists saved places newest first, and keeps one no longer available with a way to remove it", async () => {
    GET.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/api/v1/me/wishlist/ids"
          ? { data: { listing_ids: [2, 7] } }
          : {
              data: {
                items: [
                  { listing_id: 2, saved_at: "2026-11-10T10:00:00Z", available: true, listing: card(2) },
                  { listing_id: 7, saved_at: "2026-11-09T10:00:00Z", available: false, listing: null },
                ],
                total: 2,
              },
            },
      ),
    );
    DELETE.mockResolvedValue({ error: undefined });
    renderIn("fa", <WishlistView />);
    expect(await screen.findByText("Place 2")).toBeInTheDocument();
    expect(screen.getByText(/۱٬۲۰۰٬۰۰۰/)).toBeInTheDocument();
    expect(screen.getByText("دیگر در دسترس نیست")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "برداشتن از فهرست" }));
    await waitFor(() =>
      expect(DELETE).toHaveBeenCalledWith("/api/v1/me/wishlist/{listing_id}", {
        params: { path: { listing_id: 7 } },
      }),
    );
    await expectAccessible(document.body);
  });

  it("invites a member with no saves to look around", async () => {
    GET.mockResolvedValue({ data: { items: [], total: 0 } });
    renderIn("fa", <WishlistView />);
    expect(await screen.findByText("هنوز جایی را ذخیره نکرده‌اید")).toBeInTheDocument();
  });
});
