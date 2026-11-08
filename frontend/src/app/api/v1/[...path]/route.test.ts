import { afterEach, beforeEach, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { GET, POST } from "./route";

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
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('{"listing_id":1}');
    expect(response.status).toBe(201);
  });

  it("answers 503 when the API cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("down"));
    const response = await GET(new Request("http://localhost:3001/api/v1/countries"), params("countries"));
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("service_unavailable");
  });
});
