import { vi } from "vitest";

vi.mock("server-only", () => ({}));

import { serverApi } from "./server";

describe("server api", () => {
  it("asks the internal API address without any token and without caching", async () => {
    vi.stubEnv("API_INTERNAL_URL", "http://api:8000/");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ items: [], total: 0, limit: 20, offset: 0 }));
    vi.stubGlobal("fetch", fetchMock);
    await serverApi().GET("/api/v1/search/listings", {
      params: { query: { city_id: 3, amenity_ids: [1, 2] } },
    });
    const [request, init] = fetchMock.mock.calls[0]! as [Request, RequestInit];
    expect(request.url).toBe("http://api:8000/api/v1/search/listings?city_id=3&amenity_ids=1&amenity_ids=2");
    expect(request.headers.get("authorization")).toBeNull();
    expect(init).toEqual({ cache: "no-store" });
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});
