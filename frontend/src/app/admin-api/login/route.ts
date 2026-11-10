import { callApi, errorResponse, passError, sameOrigin } from "@/app/session/_lib/session";
import { setAdminCookie } from "../_lib/adminSession";

/** Admin log-in (feature 009): the token goes into the HttpOnly cookie; the page gets only how long it lasts. */
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request))
    return errorResponse(403, "bad_origin", "This request did not come from this site.");
  const upstream = await callApi(request, "/admin/auth/login", await request.json().catch(() => ({})));
  if (!upstream.ok) return passError(upstream);
  const { access_token, expires_in } = (await upstream.json()) as {
    access_token: string;
    expires_in: number;
  };
  await setAdminCookie(access_token, expires_in);
  return Response.json({ expires_in });
}
