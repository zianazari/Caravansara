import createClient from "openapi-fetch";
import { clearSession, ensureToken, refresh } from "@/lib/session";
import type { paths } from "./schema";

/**
 * The browser's API client, typed from backend/openapi.json (FR-033, research R6). Requests go to this site's
 * `/api/v1` handler, which forwards them to the API (R5).
 *
 * Each request carries the access token from memory. When the API answers 401 because the token has expired
 * or is no longer valid, the session is refreshed once (under the cross-tab lock) and the request is sent
 * again. If that fails too, the session ends and pages that need an account send the user to log in.
 */
const AUTH_CODES = new Set(["token_expired", "invalid_token"]);

/** How far the server's clock is ahead of this device's, from the last `Date` header (research R12). */
let skewMs = 0;

export function serverSkewMs(): number {
  return skewMs;
}

export function noteServerDate(response: Response, now: number = Date.now()): void {
  const date = response.headers.get("date");
  const server = date ? Date.parse(date) : Number.NaN;
  if (!Number.isNaN(server)) skewMs = server - now;
}

async function authCode(response: Response): Promise<string | undefined> {
  if (response.status !== 401) return undefined;
  try {
    const body = (await response.clone().json()) as { error?: { code?: string } };
    return body.error?.code;
  } catch {
    return undefined;
  }
}

function withToken(request: Request, token: string | null): Request {
  const next = new Request(request);
  if (token) next.headers.set("authorization", `Bearer ${token}`);
  return next;
}

export async function authFetch(request: Request): Promise<Response> {
  const retry = request.clone();
  const token = await ensureToken();
  const first = await fetch(withToken(request, token));
  noteServerDate(first);

  const code = await authCode(first);
  if (!token || !code || !AUTH_CODES.has(code)) return first;

  const renewed = await refresh({ force: true });
  if (!renewed) {
    clearSession();
    return first;
  }
  const second = await fetch(withToken(retry, renewed));
  noteServerDate(second);
  if ((await authCode(second)) !== undefined) clearSession();
  return second;
}

export const api = createClient<paths>({
  baseUrl: typeof window === "undefined" ? "" : window.location.origin,
  fetch: authFetch,
});
