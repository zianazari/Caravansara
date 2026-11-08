import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

const replace = vi.fn();
let state: "checking" | "signedIn" | "signedOut" = "checking";
vi.mock("@/hooks/useAuth", () => ({ useAuthState: () => state }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ replace }), usePathname: () => "/listings/5" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("adults=2&check_in=2026-12-01"),
}));

import { RequireAuth } from "./RequireAuth";

describe("RequireAuth", () => {
  beforeEach(() => replace.mockReset());

  it("waits while the session is being restored", () => {
    state = "checking";
    render(<RequireAuth>secret page</RequireAuth>);
    expect(screen.queryByText("secret page")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a visitor who is not signed in to log in, with the way back", () => {
    state = "signedOut";
    render(<RequireAuth>secret page</RequireAuth>);
    expect(screen.queryByText("secret page")).toBeNull();
    expect(replace).toHaveBeenCalledWith({
      pathname: "/login",
      query: { returnTo: "/listings/5?adults=2&check_in=2026-12-01" },
    });
  });

  it("shows the page to a signed-in user", () => {
    state = "signedIn";
    render(<RequireAuth>secret page</RequireAuth>);
    expect(screen.getByText("secret page")).toBeInTheDocument();
  });
});
