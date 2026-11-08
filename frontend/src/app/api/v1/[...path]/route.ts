import { apiInternalUrl, clientAddress } from "@/lib/server/upstream";

/**
 * The browser talks only to this site; this handler forwards `/api/v1/*` to the API (research R5).
 *
 * It replaces a `rewrites` rule from the plan, for two reasons. Next.js fixes rewrites at build time, so
 * the API address would be locked into the image; here it is read at run time. The handler also sets
 * X-Forwarded-For itself (R19) instead of relying on the rewrite proxy. `/api/v1/auth/*` never gets here:
 * `proxy.ts` answers it with 404, so log-in goes only through `/session/*`.
 *
 * Only the headers the API uses are passed on, so the site's cookies (the refresh token) never reach the API
 * this way. The API's `Date` header is passed back for the hold countdown (R12).
 */
const REQUEST_HEADERS = ["authorization", "content-type", "accept", "accept-language", "idempotency-key"];
const RESPONSE_HEADERS = ["content-type", "date", "cache-control", "retry-after"];

async function forward(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = new URL(request.url);
  const target = `${apiInternalUrl()}/api/v1/${path.map(encodeURIComponent).join("/")}${url.search}`;

  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const address = clientAddress(request.headers);
  if (address) headers.set("x-forwarded-for", address);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { error: { code: "service_unavailable", message: "The service is not reachable." } },
      { status: 503 },
    );
  }

  const out = new Headers();
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
