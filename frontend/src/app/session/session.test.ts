import { afterEach, beforeEach, vi } from "vitest";

const jar = new Map<string, { value: string; options: Record<string, unknown> }>();
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, options: Record<string, unknown>) => jar.set(name, { value, options }),
  }),
}));

import { POST as login } from "./login/route";
import { POST as logout } from "./logout/route";
import { POST as refresh } from "./refresh/route";
import { POST as register } from "./register/route";

const SITE = "http://localhost:3001";
const post = (path: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(`${SITE}${path}`, {
    method: "POST",
    headers: { origin: SITE, host: "localhost:3001", "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const tokens = { access_token: "acc", refresh_token: "ref-secret", token_type: "bearer", expires_in: 900 };

describe("/session route handlers", () => {
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

  it("logs in: the refresh token goes into a protected cookie, never into the body (SC-006)", async () => {
    fetchMock.mockResolvedValue(Response.json(tokens));
    const response = await login(
      post("/session/login", { email: "a@b.c", password: "pw" }, { "x-forwarded-for": "203.0.113.9" }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ access_token: "acc", expires_in: 900 });
    expect(JSON.stringify(body)).not.toContain("ref-secret");

    const cookie = jar.get("cv_refresh")!;
    expect(cookie.value).toBe("ref-secret");
    expect(cookie.options).toMatchObject({
      httpOnly: true,
      sameSite: "strict",
      path: "/session",
      maxAge: 2592000,
      secure: false,
    });

    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("http://api:8000/api/v1/auth/login");
    expect(new Headers(init.headers).get("x-forwarded-for")).toBe("203.0.113.9");
  });

  it("marks the cookie Secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    fetchMock.mockResolvedValue(Response.json(tokens));
    await login(post("/session/login", { email: "a@b.c", password: "pw" }));
    expect(jar.get("cv_refresh")!.options.secure).toBe(true);
  });

  it("registers and returns the user with the access token", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ user: { id: 7, full_name: "Ava" }, tokens }, { status: 201 }),
    );
    const response = await register(
      post("/session/register", { email: "a@b.c", password: "pw-pw-pw", full_name: "Ava" }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      access_token: "acc",
      expires_in: 900,
      user: { id: 7, full_name: "Ava" },
    });
    expect(jar.get("cv_refresh")!.value).toBe("ref-secret");
  });

  it("passes API errors on with the same status and code", async () => {
    for (const [status, code] of [
      [401, "invalid_credentials"],
      [409, "email_taken"],
      [429, "too_many_attempts"],
    ] as const) {
      fetchMock.mockResolvedValueOnce(Response.json({ error: { code, message: "x" } }, { status }));
      const response = await login(post("/session/login", { email: "a@b.c", password: "pw" }));
      expect(response.status).toBe(status);
      expect((await response.json()).error.code).toBe(code);
    }
    expect(jar.size).toBe(0);
  });

  it("refuses a request from another site or without an Origin", async () => {
    for (const headers of [{ origin: "https://evil.example" }, { origin: "" }]) {
      const response = await login(post("/session/login", {}, headers));
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe("bad_origin");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes from the cookie and rotates it", async () => {
    jar.set("cv_refresh", { value: "ref-old", options: {} });
    fetchMock.mockResolvedValue(Response.json({ ...tokens, refresh_token: "ref-new" }));
    const response = await refresh(post("/session/refresh"));
    expect(await response.json()).toEqual({ access_token: "acc", expires_in: 900 });
    expect(JSON.parse(String((fetchMock.mock.calls[0]![1] as RequestInit).body))).toEqual({
      refresh_token: "ref-old",
    });
    expect(jar.get("cv_refresh")!.value).toBe("ref-new");
  });

  it("answers 204 without a cookie, and 401 with a cookie the API refuses", async () => {
    expect((await refresh(post("/session/refresh"))).status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();

    jar.set("cv_refresh", { value: "ref-revoked", options: {} });
    fetchMock.mockResolvedValue(Response.json({ error: { code: "invalid_token" } }, { status: 401 }));
    const response = await refresh(post("/session/refresh"));
    expect(response.status).toBe(401);
    expect(jar.get("cv_refresh")!.options.maxAge).toBe(0);

    jar.set("cv_refresh", { value: "ref-ok", options: {} });
    fetchMock.mockResolvedValue(new Response("{}", { status: 503 }));
    expect((await refresh(post("/session/refresh"))).status).toBe(503);
    expect(jar.get("cv_refresh")!.value).toBe("ref-ok");
  });

  it("logs out in the API and clears the cookie even when the API cannot be reached", async () => {
    jar.set("cv_refresh", { value: "ref-1", options: {} });
    fetchMock.mockRejectedValue(new TypeError("down"));
    const response = await logout(post("/session/logout"));
    expect(response.status).toBe(204);
    expect(fetchMock).toHaveBeenCalledWith("http://api:8000/api/v1/auth/logout", expect.anything());
    expect(jar.get("cv_refresh")!.options.maxAge).toBe(0);

    jar.clear();
    expect((await logout(post("/session/logout"))).status).toBe(204);
  });
});
