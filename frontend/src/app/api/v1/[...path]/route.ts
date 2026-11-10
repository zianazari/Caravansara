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
 *
 * Bodies are streamed to the API, not read whole into memory, and capped at MAX_FORWARD_BYTES: the largest body
 * the API takes is a profile picture (specs/006-avatar-upload-via-api, research R7). A body over the cap gets
 * the API's own answer, 413 image_too_large, so the visitor sees the same message either way.
 */
/** The profile picture limit (5 MB) plus room for nothing else: no other body comes near it. */
export const MAX_FORWARD_BYTES = 5 * 1024 * 1024 + 64 * 1024;
const PICTURE_LIMIT = 5 * 1024 * 1024;

function tooLarge(): Response {
  return Response.json(
    {
      error: {
        code: "image_too_large",
        message: "The request is larger than allowed.",
        details: { max_bytes: PICTURE_LIMIT },
      },
    },
    { status: 413 },
  );
}

/** The body, counted as it passes; past the cap the stream fails and the request is answered with 413. */
function capped(body: ReadableStream<Uint8Array>, onTooLarge: () => void): ReadableStream<Uint8Array> {
  let seen = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        seen += chunk.byteLength;
        if (seen > MAX_FORWARD_BYTES) {
          onTooLarge();
          controller.error(new Error("body over the cap"));
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );
}
const REQUEST_HEADERS = ["authorization", "content-type", "accept", "accept-language", "idempotency-key"];
const RESPONSE_HEADERS = ["content-type", "date", "cache-control", "retry-after"];

async function forward(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return forwardTo(request, path);
}

/**
 * Sends one request on to `/api/v1/{path}` of the API. `authorization` replaces the browser's header: the admin
 * panel's forwarder (app/admin-api) puts the admin token from its HttpOnly cookie there (feature 009).
 */
export async function forwardTo(request: Request, path: string[], authorization?: string): Promise<Response> {
  const url = new URL(request.url);
  const target = `${apiInternalUrl()}/api/v1/${path.map(encodeURIComponent).join("/")}${url.search}`;

  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (authorization !== undefined) headers.set("authorization", authorization);
  const address = clientAddress(request.headers);
  if (address) headers.set("x-forwarded-for", address);

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_FORWARD_BYTES) return tooLarge();
  let overCap = false;
  const body =
    request.method !== "GET" && request.method !== "HEAD" && request.body
      ? capped(request.body, () => {
          overCap = true;
        })
      : undefined;
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      // Node's fetch sends a stream body only with duplex "half".
      ...(body ? { duplex: "half" } : {}),
      redirect: "manual",
      cache: "no-store",
    } as RequestInit);
  } catch {
    if (overCap) return tooLarge();
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
