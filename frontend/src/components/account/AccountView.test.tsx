import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { expectAccessible, renderIn } from "@/test/render";

const PATCH = vi.fn();
const replace = vi.fn();
const logout = vi.fn();
const user = {
  id: 7,
  email: "ava@example.com",
  full_name: "Ava Moradi",
  avatar_url: null,
  created_at: "2026-01-01T00:00:00Z",
};
vi.mock("@/api/client", () => ({ api: { PATCH: (...a: unknown[]) => PATCH(...a) } }));
vi.mock("@/hooks/useAuth", () => ({ useMe: () => ({ data: user }) }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/session", () => ({ logout: () => logout() }));
vi.mock("./AvatarUploader", () => ({ AvatarUploader: () => <div /> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

import { AccountView } from "./AccountView";

describe("AccountView", () => {
  beforeEach(() => [PATCH, replace, logout].forEach((m) => m.mockReset()));

  it("changes only the name with PATCH /me (FR-015, FR-041)", async () => {
    PATCH.mockResolvedValue({ data: { ...user, full_name: "Ava M." } });
    renderIn("en", <AccountView />);
    const input = screen.getByLabelText("Full name");
    await userEvent.clear(input);
    await userEvent.type(input, "  Ava M. ");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(PATCH).toHaveBeenCalledWith("/api/v1/me", { body: { full_name: "Ava M." } });
  });

  it("refuses an empty name before sending", async () => {
    renderIn("fa", <AccountView />);
    await userEvent.clear(screen.getByLabelText("نام و نام خانوادگی"));
    await userEvent.type(screen.getByLabelText("نام و نام خانوادگی"), " ");
    await userEvent.click(screen.getByRole("button", { name: "ذخیره" }));
    expect(screen.getByRole("alert")).toHaveTextContent("نام باید بین ۱ تا ۱۰۰ نویسه باشد.");
    expect(PATCH).not.toHaveBeenCalled();
  });

  it("has no log-out button: it is in the header's account menu (feature 024)", () => {
    renderIn("en", <AccountView />);
    expect(screen.queryByRole("button", { name: "Log out" })).toBeNull();
  });

  it("is accessible", async () => {
    const { container } = renderIn("fa", <AccountView />);
    await expectAccessible(container);
  });
});
