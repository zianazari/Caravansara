import { forwardTo } from "@/app/api/v1/[...path]/route";
import { errorResponse, sameOrigin } from "@/app/session/_lib/session";
import { readAdminCookie } from "../../../../_lib/adminSession";

/**
 * The admin panel's API (feature 009): `/admin-api/api/v1/admin/*` goes to the API's `/api/v1/admin/*`, with the
 * admin token from the HttpOnly cookie. Only admin paths can be reached this way, and not `auth/*`: log-in goes
 * through `/admin-api/login`, so the token is never in a response a page script can read. A change (POST) must
 * come from a page of the panel itself, on top of the SameSite=Strict cookie.
 */
async function forward(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (path[0] === "auth") return errorResponse(404, "not_found", "Not found.");
  if (request.method !== "GET" && !sameOrigin(request))
    return errorResponse(403, "bad_origin", "This request did not come from this site.");
  const token = await readAdminCookie();
  if (!token) return errorResponse(401, "invalid_token", "Log in again.");
  return forwardTo(request, ["admin", ...path], `Bearer ${token}`);
}

export const GET = forward;
export const POST = forward;
