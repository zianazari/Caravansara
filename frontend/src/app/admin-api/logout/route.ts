import { errorResponse, sameOrigin } from "@/app/session/_lib/session";
import { clearAdminCookie } from "../_lib/adminSession";

/** Admin log-out: the cookie is cleared. The API has no admin log-out; the token ends by itself within 15 min. */
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request))
    return errorResponse(403, "bad_origin", "This request did not come from this site.");
  await clearAdminCookie();
  return new Response(null, { status: 204 });
}
