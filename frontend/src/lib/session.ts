/**
 * The signed-in session in the browser (research R3, R4; data-model, "Session").
 *
 * - The 15-minute access token lives only in this module's memory: not in localStorage, sessionStorage or a
 *   readable cookie, so an injected script cannot keep it past a reload (FR-012, SC-006). After a reload it is
 *   rebuilt from the HttpOnly `cv_refresh` cookie through `/session/refresh`.
 * - Refreshing runs under the browser lock `cv-refresh`, one tab at a time. The API treats a refresh token
 *   that is used twice as stolen and ends every session of the user (identity/service.py, `refresh`). Two tabs
 *   refreshing at once would do exactly that, so a tab that waited for the lock first takes the token another
 *   tab has just shared on the `cv-session` channel, and only asks the server when there is none.
 * - Logging out in one tab logs out every tab.
 */

type Message = { type: "token"; token: string; expiresAt: number } | { type: "logout" };
type Listener = (signedIn: boolean) => void;

const REFRESH_EARLY_MS = 60_000;

let accessToken: string | null = null;
let expiresAt = 0;
let version = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let inFlight: Promise<string | null> | null = null;
const listeners = new Set<Listener>();

const channel: BroadcastChannel | null =
  typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("cv-session");

channel?.addEventListener("message", (event: MessageEvent<Message>) => {
  // A message that changes nothing is ignored, so it does not look like another tab's refresh.
  const message = event.data;
  if (message?.type === "token" && message.token !== accessToken) store(message.token, message.expiresAt);
  else if (message?.type === "logout" && accessToken !== null) drop();
});

function notify(): void {
  const signedIn = accessToken !== null;
  for (const listener of listeners) listener(signedIn);
}

function schedule(): void {
  if (timer) clearTimeout(timer);
  timer = undefined;
  if (!accessToken) return;
  const wait = Math.max(0, expiresAt - Date.now() - REFRESH_EARLY_MS);
  timer = setTimeout(() => void refresh(), wait);
}

function store(token: string, until: number): void {
  accessToken = token;
  expiresAt = until;
  version++;
  schedule();
  notify();
}

function drop(): void {
  accessToken = null;
  expiresAt = 0;
  version++;
  schedule();
  notify();
}

/** The access token, or null when signed out or expired. */
export function getAccessToken(now: number = Date.now()): string | null {
  return accessToken && now < expiresAt ? accessToken : null;
}

export function isSignedIn(): boolean {
  return getAccessToken() !== null;
}

/** Keeps a token the server just issued, and shares it with the other tabs. */
export function setSession(token: string, expiresInSeconds: number): void {
  const until = Date.now() + expiresInSeconds * 1000;
  store(token, until);
  channel?.postMessage({ type: "token", token, expiresAt: until } satisfies Message);
}

/** Forgets the session here and in every other tab. */
export function clearSession(): void {
  drop();
  channel?.postMessage({ type: "logout" } satisfies Message);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  return locks ? (locks.request("cv-refresh", task) as Promise<T>) : task();
}

/**
 * A fresh access token from the refresh cookie, or null when the session has ended. Concurrent callers in
 * this tab share one request; other tabs wait for the lock.
 *
 * Without `force`, a token that still has more than a minute left is simply returned: it may be one another
 * tab has just shared. With `force` (the API has refused the current token), a server request is made unless
 * another tab refreshed while this one waited for the lock.
 */
export function refresh(options: { force?: boolean } = {}): Promise<string | null> {
  if (inFlight) return inFlight;
  const seen = version;
  inFlight = withLock(async () => {
    const current = getAccessToken();
    const fresh = current !== null && expiresAt - Date.now() > REFRESH_EARLY_MS;
    if (fresh && (!options.force || version !== seen)) return current;
    let response: Response;
    try {
      response = await fetch("/session/refresh", { method: "POST", credentials: "same-origin" });
    } catch {
      return getAccessToken(); // offline: keep what we have, try again later
    }
    if (response.status === 204) return null; // never logged in on this browser
    if (!response.ok) {
      if (response.status === 401) clearSession();
      return null;
    }
    const body = (await response.json()) as { access_token: string; expires_in: number };
    setSession(body.access_token, body.expires_in);
    return body.access_token;
  }).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

let restored: Promise<string | null> | null = null;

/**
 * The token for a request. After a page load the session is rebuilt once from the cookie; after that a
 * signed-out visitor makes no refresh request at all, and a signed-in one refreshes only when the token has
 * run out (a laptop that slept past the timer).
 */
export async function ensureToken(): Promise<string | null> {
  const token = getAccessToken();
  if (token) return token;
  if (!restored) {
    restored = refresh();
    return restored;
  }
  if (accessToken !== null) return refresh();
  return null;
}

/** Logs out on the server too (FR-013), then everywhere in the browser. */
export async function logout(): Promise<void> {
  try {
    await fetch("/session/logout", { method: "POST", credentials: "same-origin" });
  } finally {
    clearSession();
  }
}
