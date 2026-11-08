import { callApi, clearRefreshCookie, errorResponse, readRefreshCookie, sameOrigin } from "../_lib/session";

/** Ends the session in the API too (FR-013); the cookie is cleared even if the API cannot be reached. */
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request))
    return errorResponse(403, "bad_origin", "This request did not come from this site.");
  const token = await readRefreshCookie();
  if (token) await callApi(request, "/auth/logout", { refresh_token: token });
  await clearRefreshCookie();
  return new Response(null, { status: 204 });
}
