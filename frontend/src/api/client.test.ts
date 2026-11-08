import { afterEach, beforeEach, vi } from "vitest";

vi.mock("@/lib/session", () => ({
  ensureToken: vi.fn(),
  refresh: vi.fn(),
  clearSession: vi.fn(),
}));

import { clearSession, ensureToken, refresh } from "@/lib/session";
import { api, authFetch, noteServerDate, serverSkewMs } from "./client";

const unauthorized = (code: string) => Response.json({ error: { code } }, { status: 401 });

describe("api client", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(ensureToken).mockReset();
    vi.mocked(refresh).mockReset();
    vi.mocked(clearSession).mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends the access token from memory", async () => {
    vi.mocked(ensureToken).mockResolvedValue("tok");
    fetchMock.mockResolvedValue(Response.json({ id: 1 }));
    const { data } = await api.GET("/api/v1/me");
    expect(data).toEqual({ id: 1 });
    const sent = fetchMock.mock.calls[0]![0] as Request;
    expect(sent.headers.get("authorization")).toBe("Bearer tok");
    expect(new URL(sent.url).pathname).toBe("/api/v1/me");
  });

  it("sends no token for a signed-out visitor", async () => {
    vi.mocked(ensureToken).mockResolvedValue(null);
    fetchMock.mockResolvedValue(Response.json({ items: [] }));
    await authFetch(new Request("http://localhost/api/v1/countries"));
    expect((fetchMock.mock.calls[0]![0] as Request).headers.get("authorization")).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes once after token_expired and sends the request again, with its body", async () => {
    vi.mocked(ensureToken).mockResolvedValue("old");
    vi.mocked(refresh).mockResolvedValue("new");
    fetchMock
      .mockResolvedValueOnce(unauthorized("token_expired"))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    const response = await authFetch(
      new Request("http://localhost/api/v1/bookings", { method: "POST", body: JSON.stringify({ a: 1 }) }),
    );
    expect(response.status).toBe(200);
    expect(refresh).toHaveBeenCalledWith({ force: true });
    const second = fetchMock.mock.calls[1]![0] as Request;
    expect(second.headers.get("authorization")).toBe("Bearer new");
    expect(await second.text()).toBe('{"a":1}');
  });

  it("ends the session when the refresh fails, or the second answer is 401 again", async () => {
    vi.mocked(ensureToken).mockResolvedValue("old");
    vi.mocked(refresh).mockResolvedValueOnce(null);
    fetchMock.mockResolvedValueOnce(unauthorized("invalid_token"));
    expect((await authFetch(new Request("http://localhost/api/v1/me"))).status).toBe(401);
    expect(clearSession).toHaveBeenCalledTimes(1);

    vi.mocked(refresh).mockResolvedValueOnce("new");
    fetchMock
      .mockResolvedValueOnce(unauthorized("invalid_token"))
      .mockResolvedValueOnce(unauthorized("invalid_token"));
    expect((await authFetch(new Request("http://localhost/api/v1/me"))).status).toBe(401);
    expect(clearSession).toHaveBeenCalledTimes(2);
  });

  it("does not refresh for other 401s or other errors", async () => {
    vi.mocked(ensureToken).mockResolvedValue("tok");
    fetchMock.mockResolvedValueOnce(unauthorized("invalid_credentials"));
    expect((await authFetch(new Request("http://localhost/api/v1/x"))).status).toBe(401);
    fetchMock.mockResolvedValueOnce(new Response("not json", { status: 401 }));
    expect((await authFetch(new Request("http://localhost/api/v1/x"))).status).toBe(401);
    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: "hold_expired" } }, { status: 409 }));
    expect((await authFetch(new Request("http://localhost/api/v1/x"))).status).toBe(409);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("learns the server clock from the Date header (research R12)", () => {
    const now = Date.parse("2026-11-08T12:00:00Z");
    noteServerDate(new Response(null, { headers: { date: "Sun, 08 Nov 2026 12:00:30 GMT" } }), now);
    expect(serverSkewMs()).toBe(30_000);
    noteServerDate(new Response(null), now);
    expect(serverSkewMs()).toBe(30_000);
  });
});
