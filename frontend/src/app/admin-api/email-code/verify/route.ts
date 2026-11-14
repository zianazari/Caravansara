import { callApi, errorResponse, passError, sameOrigin } from "@/app/session/_lib/session";
import { setAdminCookies, type AdminTokens } from "../../_lib/adminSession";

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request))
    return errorResponse(403, "bad_origin", "This request did not come from this site.");
  const upstream = await callApi(
    request,
    "/admin/auth/email-code/verify",
    await request.json().catch(() => ({})),
  );
  if (!upstream.ok) return passError(upstream);
  const tokens = (await upstream.json()) as AdminTokens;
  await setAdminCookies(tokens);
  return Response.json(
    { session_expires_in: tokens.session_expires_in },
    { headers: { "cache-control": "no-store" } },
  );
}
