import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderIn } from "@/test/render";

let state: "signedIn" | "signedOut" | "loading" = "signedOut";
const GET = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuthState: () => state,
  useMe: () => ({ data: undefined }),
}));
vi.mock("@/api/client", () => ({ api: { GET: (...a: unknown[]) => GET(...a) } }));
const replace = vi.fn();
const logout = vi.fn(async () => {});
vi.mock("@/lib/session", () => ({ logout: () => logout() }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace }),
  Link: ({ href, children, ...rest }: { href: string | { pathname: string }; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : href.pathname} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("./LocaleSwitch", () => ({ LocaleSwitch: () => null }));

import { Header } from "./Header";

describe("Header host link (specs/008-host-pages, FR-001, R11)", () => {
  beforeEach(() => {
    GET.mockReset();
  });

  it("sends a visitor to log in, then to the new-listing form", () => {
    state = "signedOut";
    renderIn("fa", <Header />);
    expect(screen.getByRole("link", { name: "میزبان شوید" })).toHaveAttribute(
      "href",
      "/login?returnTo=/host/new",
    );
    expect(GET).not.toHaveBeenCalled();
  });

  it("sends a signed-in user without a listing to the form", async () => {
    state = "signedIn";
    GET.mockResolvedValue({ data: { items: [], total: 0 } });
    renderIn("fa", <Header />);
    const links = await screen.findAllByRole("link", { name: "میزبان شوید", hidden: true });
    expect(links[0]).toHaveAttribute("href", "/host/new");
    expect(GET).toHaveBeenCalledWith("/api/v1/me/listings", { params: { query: { limit: 1 } } });
  });

  it("shows my listings to a host, and on a phone in the account menu", async () => {
    state = "signedIn";
    GET.mockResolvedValue({ data: { items: [{ id: 1 }], total: 1 } });
    renderIn("fa", <Header />);
    const wide = await screen.findByRole("link", { name: "آگهی‌های من" });
    expect(wide).toHaveAttribute("href", "/host");
    expect(wide).toHaveClass("hidden", "md:inline-flex");

    await userEvent.click(screen.getByRole("button", { name: "حساب من" }));
    const menu = await screen.findByRole("menu");
    const inMenu = within(menu).getByRole("menuitem", { name: "آگهی‌های من" });
    expect(inMenu).toHaveAttribute("href", "/host");
    expect(inMenu).toHaveClass("md:hidden");
  });

  it("ends the session from the bottom of the account menu (feature 024)", async () => {
    state = "signedIn";
    GET.mockResolvedValue({ data: { items: [], total: 0 } });
    renderIn("fa", <Header />);
    await userEvent.click(screen.getByRole("button", { name: "حساب من" }));
    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    const last = items[items.length - 1]!;
    expect(last).toHaveTextContent("خروج");
    await userEvent.click(last);
    expect(logout).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/");
  });
});
