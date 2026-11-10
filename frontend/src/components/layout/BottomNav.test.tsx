import { screen } from "@testing-library/react";
import { vi } from "vitest";
import { expectAccessible, renderIn } from "@/test/render";

let path = "/";
let state: "signedIn" | "signedOut" | "loading" = "signedOut";
vi.mock("@/hooks/useAuth", () => ({ useAuthState: () => state }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => path,
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { BottomNav } from "./BottomNav";

describe("BottomNav (specs/007-caravansara-theme, FR-008)", () => {
  it("has search, trips and log in for a visitor, with search active on the home page", () => {
    path = "/";
    state = "signedOut";
    renderIn("fa", <BottomNav />);
    const nav = screen.getByRole("navigation", { name: "ناوبری پایین" });
    expect(nav).toHaveClass("md:hidden");
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual(["جستجو", "سفرهای من", "ورود"]);
    expect(screen.getByRole("link", { name: "جستجو" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "ورود" })).toHaveAttribute("href", "/login");
  });

  it("has the profile for a signed-in user and marks the page they are on", () => {
    path = "/trips/12";
    state = "signedIn";
    renderIn("fa", <BottomNav />);
    expect(screen.getByRole("link", { name: "پروفایل" })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("link", { name: "سفرهای من" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "جستجو" })).not.toHaveAttribute("aria-current");
  });

  it("has no wishlists: they come with their own feature (Q3)", () => {
    path = "/";
    renderIn("fa", <BottomNav />);
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it.each(["/listings/5", "/book/5", "/host/new"])(
    "is not shown on %s, where the booking bar takes its place (R7)",
    (p) => {
      path = p;
      const { container } = renderIn("fa", <BottomNav />);
      expect(container).toBeEmptyDOMElement();
    },
  );

  it("is accessible", async () => {
    path = "/search";
    const { container } = renderIn("en", <BottomNav />);
    await expectAccessible(container);
  });
});
