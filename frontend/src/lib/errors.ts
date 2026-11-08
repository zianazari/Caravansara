/**
 * API errors to the user's language (FR-002, FR-003, research R7). The API sends a stable machine code and an
 * English message; the page shows only the translated message for the code, never the server's English text.
 */
export type ApiErrorBody = { error: { code: string; message?: string; details?: unknown } };

/** A translator that can say whether it has a key (next-intl's `t` has `t.has`). */
export type Translate = ((key: string, values?: Record<string, string | number>) => string) & {
  has: (key: string) => boolean;
};

export function errorCode(body: unknown): string {
  if (body && typeof body === "object" && "error" in body) {
    const code = (body as ApiErrorBody).error?.code;
    if (typeof code === "string" && code) return code;
  }
  return "unknown";
}

/** The message for an error body; a code without a translation gets the general message. */
export function errorMessage(t: Translate, body: unknown): string {
  const key = `errors.${errorCode(body)}`;
  return t.has(key) ? t(key) : t("errors.unknown");
}

/**
 * Field problems of a `validation_error`, keyed by field name, for messages next to each field. The API sends
 * `details: [{loc: ["body", "email"], type: "value_error"}, …]`; the message key is `validation.<type>`.
 */
export function fieldErrors(body: unknown): Record<string, string> {
  if (errorCode(body) !== "validation_error") return {};
  const details = (body as ApiErrorBody).error.details;
  if (!Array.isArray(details)) return {};
  const out: Record<string, string> = {};
  for (const item of details) {
    if (!item || typeof item !== "object") continue;
    const loc = (item as { loc?: unknown }).loc;
    const type = (item as { type?: unknown }).type;
    if (!Array.isArray(loc) || loc.length === 0) continue;
    const field = String(loc[loc.length - 1]);
    if (!(field in out)) out[field] = typeof type === "string" && type ? type : "invalid";
  }
  return out;
}

/** Reads a failed response's body; a body that is not JSON counts as an unknown error. */
export async function readError(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return { error: { code: "unknown" } };
  }
}
