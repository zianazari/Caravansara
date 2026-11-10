import { afterEach, beforeEach, vi } from "vitest";

const jar = new Map<string, { value: string; options: Record<string, unknown> }>();
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, options: Record<string, unknown>) => jar.set(name, { value, options }),
  }),
}));

import { GET, POST } from "./api/v1/admin/[...path]/route";
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

  it("logs in: the admin token goes into an HttpOnly cookie for /admin-api only, never into the body", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ access_token: "admin-secret", token_type: "bearer", expires_in: 900 }),
    );
    const res = await login(request("/admin-api/login", "POST", { email: "a@b.c", password: "pw" }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("admin-secret");
    expect(JSON.parse(text)).toEqual({ expires_in: 900 });
    expect(fetchMock.mock.calls[0]![0]).toBe("http://api:8000/api/v1/admin/auth/login");
    expect(jar.get("cv_admin")).toMatchObject({
      value: "admin-secret",
      options: { httpOnly: true, sameSite: "strict", path: "/admin-api", maxAge: 900 },
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

  it("logs out by clearing the cookie", async () => {
    jar.set("cv_admin", { value: "t", options: {} });
    expect((await logout(request("/admin-api/logout", "POST"))).status).toBe(204);
    expect(jar.get("cv_admin")).toMatchObject({ value: "", options: { maxAge: 0 } });
  });
});
