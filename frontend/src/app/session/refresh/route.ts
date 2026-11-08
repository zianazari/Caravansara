import {
  callApi,
  clearRefreshCookie,
  errorResponse,
  issue,
  readRefreshCookie,
  sameOrigin,
} from "../_lib/session";

/**
 * Rotates the session. Pages call it under a browser lock, one tab at a time (research R4): the API treats a
 * refresh token used twice as stolen and ends every session of the user.
 */
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request))
    return errorResponse(403, "bad_origin", "This request did not come from this site.");
  const token = await readRefreshCookie();
  // No cookie means a visitor who never logged in: "no session" (204), not an error. Every page load asks once,
  // and a 401 here would put an error in every anonymous visitor's console. 401 stays for an ended session.
  if (!token) return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  const upstream = await callApi(request, "/auth/refresh", { refresh_token: token });
  if (!upstream.ok) {
    if (upstream.status === 401) {
      await clearRefreshCookie();
      return errorResponse(401, "invalid_token", "The session has ended.");
    }
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  }
  return issue(await upstream.json());
}
