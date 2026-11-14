import { callApi, errorResponse, passError, sameOrigin } from "../../_lib/session";

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request))
    return errorResponse(403, "bad_origin", "This request did not come from this site.");
  const upstream = await callApi(request, "/auth/email-code/request", await request.json().catch(() => ({})));
  if (!upstream.ok) return passError(upstream);
  return Response.json(await upstream.json(), { headers: { "cache-control": "no-store" } });
}
