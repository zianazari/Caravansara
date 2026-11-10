import { afterEach, beforeEach, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { GET, MAX_FORWARD_BYTES, POST, PUT } from "./route";

const params = (...path: string[]) => ({ params: Promise.resolve({ path }) });

describe("/api/v1 forwarder", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("API_INTERNAL_URL", "http://api:8000");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("forwards the path, query and only the headers the API uses", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ ok: 1 }, { headers: { date: "Sun, 08 Nov 2026 12:00:00 GMT", "set-cookie": "x=1" } }),
    );
    const request = new Request(
      "http://localhost:3001/api/v1/search/listings?city_id=1&amenity_ids=2&amenity_ids=3",
      {
        headers: {
          authorization: "Bearer t",
          cookie: "cv_refresh=secret",
          "x-forwarded-for": "198.51.100.1, 203.0.113.7",
        },
      },
    );
    const response = await GET(request, params("search", "listings"));
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("http://api:8000/api/v1/search/listings?city_id=1&amenity_ids=2&amenity_ids=3");
    const sent = new Headers(init.headers);
    expect(sent.get("authorization")).toBe("Bearer t");
    expect(sent.get("cookie")).toBeNull(); // the refresh cookie never reaches the API this way
    expect(sent.get("x-forwarded-for")).toBe("203.0.113.7"); // the address the nearest proxy saw
    expect(response.headers.get("date")).toBe("Sun, 08 Nov 2026 12:00:00 GMT");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toEqual({ ok: 1 });
  });

  it("forwards bodies and the idempotency key", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 9 }, { status: 201 }));
    const request = new Request("http://localhost:3001/api/v1/bookings", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "k-1" },
      body: '{"listing_id":1}',
    });
    const response = await POST(request, params("bookings"));
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(new Headers(init.headers).get("idempotency-key")).toBe("k-1");
    // 006: the body is streamed to the API, not read whole into memory first (research R7).
    expect((init as RequestInit & { duplex?: string }).duplex).toBe("half");
    expect(await new Response(init.body as ReadableStream).text()).toBe('{"listing_id":1}');
    expect(response.status).toBe(201);
  });

  // specs/006-avatar-upload-via-api, research R7: the site caps every body at the profile picture limit
  // plus a little, so a huge body never fills the site's memory; the answer matches the API's own (G1).
  const tooLarge = {
    error: { code: "image_too_large", message: expect.any(String), details: { max_bytes: 5242880 } },
  };

  it("refuses a declared body over the cap with 413, without calling the API", async () => {
    const request = new Request("http://localhost:3001/api/v1/me/avatar", {
      method: "PUT",
      headers: { "content-type": "image/png", "content-length": String(MAX_FORWARD_BYTES + 1) },
      body: "x",
    });
    const response = await PUT(request, params("me", "avatar"));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual(tooLarge);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cuts off a streamed body without a length once it passes the cap", async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      await new Response(init.body as ReadableStream).arrayBuffer(); // the API reads the stream
      return Response.json({}, { status: 200 });
    });
    const chunk = new Uint8Array(64 * 1024);
    let left = Math.ceil(MAX_FORWARD_BYTES / chunk.length) + 4;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (left-- > 0) controller.enqueue(chunk);
        else controller.close();
      },
    });
    const request = new Request("http://localhost:3001/api/v1/me/avatar", {
      method: "PUT",
      headers: { "content-type": "image/png" },
      body,
      duplex: "half",
    } as RequestInit);
    const response = await PUT(request, params("me", "avatar"));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual(tooLarge);
  });

  it("passes a picture under the cap on to the API with its content type", async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const bytes = new Uint8Array(await new Response(init.body as ReadableStream).arrayBuffer());
      return Response.json({ size: bytes.length, type: new Headers(init.headers).get("content-type") });
    });
    const picture = new Uint8Array(300_000);
    const request = new Request("http://localhost:3001/api/v1/me/avatar", {
      method: "PUT",
      headers: { "content-type": "image/jpeg" },
      body: picture,
    });
    const response = await PUT(request, params("me", "avatar"));
    expect(await response.json()).toEqual({ size: 300_000, type: "image/jpeg" });
  });

  it("answers 503 when the API cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("down"));
    const response = await GET(new Request("http://localhost:3001/api/v1/countries"), params("countries"));
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("service_unavailable");
  });
});
