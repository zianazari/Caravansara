import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { expectAccessible, renderIn } from "@/test/render";

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace }),
  Link: ({ children, href }: { children: React.ReactNode; href: unknown }) => (
    <a href={JSON.stringify(href)}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => search }));
const setSession = vi.fn();
vi.mock("@/lib/session", () => ({ setSession: (...a: unknown[]) => setSession(...a) }));

import { AuthForm } from "./AuthForm";

describe("AuthForm", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    replace.mockReset();
    setSession.mockReset();
    search = new URLSearchParams();
  });
  afterEach(() => vi.unstubAllGlobals());

  async function fill(values: Record<string, string>) {
    for (const [label, value] of Object.entries(values))
      await userEvent.type(screen.getByLabelText(label), value);
  }

  it("logs in through /session, keeps only the access token, and goes back where it came from (US2/AC7)", async () => {
    search = new URLSearchParams("returnTo=/fa/listings/5?adults=2");
    fetchMock.mockResolvedValue(Response.json({ access_token: "acc", expires_in: 900 }));
    renderIn("fa", <AuthForm mode="login" />);
    await fill({ ایمیل: "guest@example.com", رمز: "pw" });
    await userEvent.click(screen.getByRole("button", { name: "ورود" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/listings/5?adults=2"));
    expect(fetchMock).toHaveBeenCalledWith("/session/login", expect.objectContaining({ method: "POST" }));
    expect(setSession).toHaveBeenCalledWith("acc", 900);
  });

  it("never follows a return address to another site", async () => {
    search = new URLSearchParams("returnTo=//evil.example");
    fetchMock.mockResolvedValue(Response.json({ access_token: "acc", expires_in: 900 }));
    renderIn("en", <AuthForm mode="login" />);
    await fill({ Email: "guest@example.com", Password: "pw" });
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("says only that the email or password is wrong (US2/AC3)", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: { code: "invalid_credentials", message: "x" } }, { status: 401 }),
    );
    renderIn("fa", <AuthForm mode="login" />);
    await fill({ ایمیل: "guest@example.com", رمز: "wrong" });
    await userEvent.click(screen.getByRole("button", { name: "ورود" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("ایمیل یا رمز درست نیست.");
    expect(setSession).not.toHaveBeenCalled();
  });

  it("explains rate limiting in the user's language (US2/AC4)", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: "too_many_attempts" } }, { status: 429 }));
    renderIn("en", <AuthForm mode="login" />);
    await fill({ Email: "guest@example.com", Password: "pw" });
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many attempts. Please try again later.");
  });

  it("says when the email already has an account, and creates none (US2/AC2)", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: "email_taken" } }, { status: 409 }));
    renderIn("en", <AuthForm mode="register" />);
    await fill({ "Full name": "Ava", Email: "ava@example.com", Password: "long-enough" });
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "An account with this email already exists. Please log in.",
    );
    expect(setSession).not.toHaveBeenCalled();
  });

  it("checks the fields before sending, with the API's own limits (FR-010)", async () => {
    renderIn("fa", <AuthForm mode="register" />);
    await fill({ ایمیل: "not-an-email", رمز: "short" });
    await userEvent.click(screen.getByRole("button", { name: "ساخت حساب" }));
    expect(screen.getByText("یک ایمیل درست وارد کنید.")).toBeInTheDocument();
    expect(screen.getByText("رمز باید بین ۸ تا ۱۲۸ نویسه باشد.")).toBeInTheDocument();
    expect(screen.getByText("نام باید بین ۱ تا ۱۰۰ نویسه باشد.")).toBeInTheDocument();
    expect(screen.getByLabelText("رمز")).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the API's field errors next to the field", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { error: { code: "validation_error", details: [{ loc: ["body", "email"], type: "value_error" }] } },
        { status: 422 },
      ),
    );
    renderIn("en", <AuthForm mode="register" />);
    await fill({ "Full name": "Ava", Email: "a@b.cd", Password: "long-enough" });
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("This value is not valid.")).toBeInTheDocument();
  });

  it("is accessible", async () => {
    const { container } = renderIn("fa", <AuthForm mode="register" />);
    await expectAccessible(container);
  });
});
