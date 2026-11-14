import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderIn, expectAccessible } from "@/test/render";
import { EmailCodeForm } from "./EmailCodeForm";

const challenge = { challenge_id: "12345678-1234-1234-1234-123456789012", expires_in: 300, resend_after: 60 };
let fetchMock: ReturnType<typeof vi.fn>;
const success = vi.fn();
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  success.mockReset();
  success.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it.each(["fa", "en"] as const)("validates email and is accessible in %s", async (locale) => {
  const { container } = renderIn(locale, <EmailCodeForm onSuccess={success} />);
  fireEvent.submit(container.querySelector("form")!);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  await expectAccessible(container);
});

it("sends the email, accepts Persian digits and preserves leading zeroes", async () => {
  fetchMock
    .mockResolvedValueOnce(Response.json(challenge))
    .mockResolvedValueOnce(Response.json({ access_token: "access", expires_in: 900 }));
  const { container } = renderIn("fa", <EmailCodeForm onSuccess={success} />);
  await userEvent.type(screen.getByLabelText("ایمیل"), "guest@example.com");
  await userEvent.click(screen.getByRole("button", { name: "ارسال کد ورود" }));
  expect(await screen.findByRole("status")).toHaveTextContent("اگر با این ایمیل حساب کاربری داشته باشی");
  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    "/session/email-code/request",
    expect.objectContaining({ body: JSON.stringify({ email: "guest@example.com", locale: "fa" }) }),
  );
  expect(screen.getByLabelText("ایمیل")).toHaveAttribute("readonly");
  await expectAccessible(container);
  await userEvent.type(screen.getByLabelText("کد ۵ رقمی"), "۰۰۰۰۷");
  expect(screen.getByLabelText("کد ۵ رقمی")).toHaveValue("00007");
  await userEvent.click(screen.getByRole("button", { name: "تأیید کد و ورود" }));
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    "/session/email-code/verify",
    expect.objectContaining({
      body: JSON.stringify({ challenge_id: challenge.challenge_id, code: "00007" }),
    }),
  );
  expect(success).toHaveBeenCalledWith({ access_token: "access", expires_in: 900 });
});

it("allows a new request after the countdown and resets the entered code", async () => {
  vi.useFakeTimers();
  fetchMock.mockImplementation(() => Promise.resolve(Response.json(challenge)));
  renderIn("en", <EmailCodeForm onSuccess={success} />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "guest@example.com" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send sign-in code" }));
  });
  expect(screen.getByRole("button", { name: "Resend in 60 seconds" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("5-digit code"), { target: { value: "12345" } });
  await act(async () => {
    vi.advanceTimersByTime(61000);
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Resend code" }));
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(screen.getByLabelText("5-digit code")).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: "Change email" }));
  expect(screen.queryByLabelText("5-digit code")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Email")).not.toHaveAttribute("readonly");
});

it("rejects incomplete codes and shows translated invalid/expired-code errors", async () => {
  fetchMock
    .mockResolvedValueOnce(Response.json(challenge))
    .mockResolvedValueOnce(
      Response.json({ error: { code: "invalid_email_code", message: "invalid" } }, { status: 401 }),
    );
  renderIn("en", <EmailCodeForm onSuccess={success} />);
  await userEvent.type(screen.getByLabelText("Email"), "guest@example.com");
  await userEvent.click(screen.getByRole("button", { name: "Send sign-in code" }));
  await userEvent.click(screen.getByRole("button", { name: "Verify code and sign in" }));
  expect(screen.getByText("Enter the complete 5-digit code.")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await userEvent.type(screen.getByLabelText("5-digit code"), "12345");
  await userEvent.click(screen.getByRole("button", { name: "Verify code and sign in" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("The code is incorrect or expired");
  expect(success).not.toHaveBeenCalled();
});

it("handles unavailable mail delivery and failed requests", async () => {
  fetchMock
    .mockResolvedValueOnce(Response.json({ error: { code: "service_unavailable" } }, { status: 503 }))
    .mockRejectedValueOnce(new Error("offline"));
  renderIn("en", <EmailCodeForm onSuccess={success} />);
  await userEvent.type(screen.getByLabelText("Email"), "guest@example.com");
  for (let i = 0; i < 2; i++) {
    await userEvent.click(screen.getByRole("button", { name: "Send sign-in code" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/unavailable|reachable|try again/i),
    );
  }
});
