import { callApi, errorResponse, issue, passError, sameOrigin } from "../_lib/session";

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request))
    return errorResponse(403, "bad_origin", "This request did not come from this site.");
  const upstream = await callApi(request, "/auth/register", await request.json().catch(() => ({})));
  if (!upstream.ok) return passError(upstream);
  const { user, tokens } = await upstream.json();
  return issue(tokens, { user }, 201);
}
