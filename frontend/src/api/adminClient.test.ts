import { afterEach, beforeEach, vi } from "vitest";
import { adminApi, adminLogin, adminLogout } from "./adminClient";

describe("admin client (feature 009)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn(async () => Response.json({ items: [], total: 0 }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("logs in and out through the panel's own handlers, never holding a token", async () => {
    await adminLogin("a@b.c", "pw");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/admin-api/login",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ email: "a@b.c", password: "pw" }) }),
    );
    await adminLogout();
    expect(fetchMock).toHaveBeenLastCalledWith("/admin-api/logout", { method: "POST" });
  });

  it("sends API calls to the panel's forwarder, with no Authorization header", async () => {
    await adminApi.GET("/api/v1/admin/listings/pending", { params: { query: { limit: 20 } } });
    const sent = fetchMock.mock.calls[0]![0] as Request;
    expect(sent.url).toBe(`${window.location.origin}/admin-api/api/v1/admin/listings/pending?limit=20`);
    expect(sent.headers.get("authorization")).toBeNull();
  });
});
