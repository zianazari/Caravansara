import { callApi, errorResponse, sameOrigin } from "@/app/session/_lib/session";
import { clearAdminCookies, readAdminRefreshCookie } from "../_lib/adminSession";

/** Admin log-out: the API ends the refresh token, and both cookies are cleared. */
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request))
    return errorResponse(403, "bad_origin", "This request did not come from this site.");
  const refreshToken = await readAdminRefreshCookie();
  if (refreshToken) await callApi(request, "/admin/auth/logout", { refresh_token: refreshToken });
  await clearAdminCookies();
  return new Response(null, { status: 204 });
}
