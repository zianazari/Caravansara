import { errorCode, errorMessage, fieldErrors, readError, type Translate } from "./errors";

const messages: Record<string, string> = {
  "errors.dates_unavailable": "این تاریخ‌ها همین الان رزرو شد.",
  "errors.unknown": "مشکلی پیش آمد.",
};
const t = Object.assign((key: string) => messages[key] ?? key, {
  has: (key: string) => key in messages,
}) as Translate;

describe("errors", () => {
  it("translates a known code and never shows the server's English text", () => {
    const body = { error: { code: "dates_unavailable", message: "These dates were just booked." } };
    expect(errorMessage(t, body)).toBe("این تاریخ‌ها همین الان رزرو شد.");
  });

  it("uses the general message for an unknown code or a body that is not an API error", () => {
    expect(errorMessage(t, { error: { code: "brand_new_code", message: "English" } })).toBe("مشکلی پیش آمد.");
    expect(errorMessage(t, "plain text")).toBe("مشکلی پیش آمد.");
    expect(errorMessage(t, null)).toBe("مشکلی پیش آمد.");
    expect(errorCode({ error: { code: "" } })).toBe("unknown");
  });

  it("maps validation details to fields", () => {
    const body = {
      error: {
        code: "validation_error",
        details: [
          { loc: ["body", "email"], msg: "…", type: "value_error" },
          { loc: ["body", "password"], msg: "…", type: "string_too_short" },
          { loc: ["body", "password"], msg: "…", type: "second_problem" },
          { loc: [], type: "ignored" },
          { loc: ["body", "full_name"] },
          "not an object",
        ],
      },
    };
    expect(fieldErrors(body)).toEqual({
      email: "value_error",
      password: "string_too_short",
      full_name: "invalid",
    });
    expect(fieldErrors({ error: { code: "validation_error" } })).toEqual({});
    expect(fieldErrors({ error: { code: "email_taken" } })).toEqual({});
  });

  it("reads error bodies, and treats a broken body as unknown", async () => {
    expect(await readError(Response.json({ error: { code: "hold_expired" } }))).toEqual({
      error: { code: "hold_expired" },
    });
    expect(errorCode(await readError(new Response("<html>")))).toBe("unknown");
  });
});
