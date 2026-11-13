import { afterEach, beforeEach, vi } from "vitest";

const jar = new Map<string, { value: string; options: Record<string, unknown> }>();
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, options: Record<string, unknown>) => jar.set(name, { value, options }),
  }),
}));

import { DELETE, GET, POST, PUT } from "./api/v1/admin/[...path]/route";
import { POST as login } from "./login/route";
import { POST as logout } from "./logout/route";

const ADMIN = "http://admin.localhost:3001";
const request = (path: string, method = "GET", body?: unknown, origin: string | null = ADMIN) =>
  new Request(`${ADMIN}${path}`, {
    method,
    headers: {
      host: "admin.localhost:3001",
      "content-type": "application/json",
      ...(origin ? { origin } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const params = (...path: string[]) => ({ params: Promise.resolve({ path }) });
const tokens = (n = "") => ({
  access_token: `admin-secret${n}`,
  refresh_token: `refresh-secret${n}`,
  token_type: "bearer",
  expires_in: 900,
  session_expires_in: 28800,
});

describe("admin panel handlers (feature 009)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    jar.clear();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("API_INTERNAL_URL", "http://api:8000");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("logs in: both tokens go into HttpOnly cookies for /admin-api only, never into the body", async () => {
    fetchMock.mockResolvedValue(Response.json(tokens()));
    const res = await login(request("/admin-api/login", "POST", { email: "a@b.c", password: "pw" }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("admin-secret");
    expect(text).not.toContain("refresh-secret");
    expect(JSON.parse(text)).toEqual({ session_expires_in: 28800 });
    expect(fetchMock.mock.calls[0]![0]).toBe("http://api:8000/api/v1/admin/auth/login");
    expect(jar.get("cv_admin")).toMatchObject({
      value: "admin-secret",
      options: { httpOnly: true, sameSite: "strict", path: "/admin-api", maxAge: 870 },
    });
    expect(jar.get("cv_admin_refresh")).toMatchObject({
      value: "refresh-secret",
      options: { httpOnly: true, sameSite: "strict", path: "/admin-api", maxAge: 28800 },
    });
  });

  it("passes a failed log-in on and sets no cookie", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: { code: "invalid_credentials", message: "x" } }, { status: 401 }),
    );
    const res = await login(request("/admin-api/login", "POST", { email: "a@b.c", password: "no" }));
    expect(res.status).toBe(401);
    expect(jar.has("cv_admin")).toBe(false);
  });

  it("refuses a log-in or a decision from another site", async () => {
    expect((await login(request("/admin-api/login", "POST", {}, "https://evil.example"))).status).toBe(403);
    jar.set("cv_admin", { value: "t", options: {} });
    const res = await POST(
      request("/admin-api/api/v1/admin/listings/4/approve", "POST", {}, "https://evil.example"),
      params("listings", "4", "approve"),
    );
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards admin paths with the token from the cookie", async () => {
    jar.set("cv_admin", { value: "admin-secret", options: {} });
    fetchMock.mockResolvedValue(Response.json({ items: [], total: 0 }));
    const res = await GET(
      request("/admin-api/api/v1/admin/listings/pending?limit=20"),
      params("listings", "pending"),
    );
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api:8000/api/v1/admin/listings/pending?limit=20");
    expect((init.headers as Headers).get("authorization")).toBe("Bearer admin-secret");
  });

  it("forwards holiday updates and deletions only from the admin's own site", async () => {
    jar.set("cv_admin", { value: "admin-secret", options: {} });
    fetchMock.mockResolvedValue(Response.json({ name: "Holiday" }));
    const url = "/admin-api/api/v1/admin/holidays/IR/2027-01-01";
    for (const [method, handler] of [
      ["PUT", PUT],
      ["DELETE", DELETE],
    ] as const) {
      const body = method === "PUT" ? { name: "Holiday" } : undefined;
      expect(
        (
          await handler(
            request(url, method, body, "https://evil.example"),
            params("holidays", "IR", "2027-01-01"),
          )
        ).status,
      ).toBe(403);
      const res = await handler(request(url, method, body), params("holidays", "IR", "2027-01-01"));
      expect(res.status).toBe(200);
      const [target, init] = fetchMock.mock.calls.at(-1)!;
      expect(target).toBe("http://api:8000/api/v1/admin/holidays/IR/2027-01-01");
      expect(init.method).toBe(method);
      expect(init.headers.get("authorization")).toBe("Bearer admin-secret");
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("answers 401 without a session, and never forwards admin log-in", async () => {
    expect(
      (await GET(request("/admin-api/api/v1/admin/listings/pending"), params("listings", "pending"))).status,
    ).toBe(401);
    jar.set("cv_admin", { value: "t", options: {} });
    expect(
      (await POST(request("/admin-api/api/v1/admin/auth/login", "POST", {}), params("auth", "login"))).status,
    ).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renews the admin token with the refresh token when it is gone, once for requests at the same moment (011)", async () => {
    jar.set("cv_admin_refresh", { value: "refresh-secret", options: {} });
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/admin/auth/refresh")
        ? Response.json(tokens("-2"))
        : Response.json({ items: [], total: 0 }),
    );
    const [a, b] = await Promise.all([
      GET(request("/admin-api/api/v1/admin/listings/pending"), params("listings", "pending")),
      GET(request("/admin-api/api/v1/admin/listings/pending"), params("listings", "pending")),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const refreshes = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/admin/auth/refresh"));
    expect(refreshes).toHaveLength(1);
    expect(JSON.parse(refreshes[0]![1].body as string)).toEqual({ refresh_token: "refresh-secret" });
    const forwarded = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/listings/pending"));
    expect((forwarded[0]![1].headers as Headers).get("authorization")).toBe("Bearer admin-secret-2");
    expect(jar.get("cv_admin")?.value).toBe("admin-secret-2");
    expect(jar.get("cv_admin_refresh")?.value).toBe("refresh-secret-2");
  });

  it("asks to log in again when the session has ended, and clears both cookies", async () => {
    jar.set("cv_admin_refresh", { value: "old", options: {} });
    fetchMock.mockResolvedValue(
      Response.json({ error: { code: "invalid_token", message: "x" } }, { status: 401 }),
    );
    const res = await GET(request("/admin-api/api/v1/admin/listings/pending"), params("listings", "pending"));
    expect(res.status).toBe(401);
    expect(jar.get("cv_admin_refresh")).toMatchObject({ value: "", options: { maxAge: 0 } });
  });

  it("logs out: the API ends the refresh token and both cookies are cleared", async () => {
    jar.set("cv_admin", { value: "t", options: {} });
    jar.set("cv_admin_refresh", { value: "refresh-secret", options: {} });
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect((await logout(request("/admin-api/logout", "POST"))).status).toBe(204);
    expect(fetchMock.mock.calls[0]![0]).toBe("http://api:8000/api/v1/admin/auth/logout");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toEqual({
      refresh_token: "refresh-secret",
    });
    expect(jar.get("cv_admin")).toMatchObject({ value: "", options: { maxAge: 0 } });
    expect(jar.get("cv_admin_refresh")).toMatchObject({ value: "", options: { maxAge: 0 } });
  });
});
