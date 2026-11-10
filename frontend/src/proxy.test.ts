import { NextRequest } from "next/server";
import { afterEach, beforeEach, vi } from "vitest";
import { isAdminPath, isAdminRequest } from "./lib/adminHost";
import { proxy } from "./proxy";

const at = (url: string, host: string) => new NextRequest(url, { headers: { host } });

describe("admin host routing (feature 009)", () => {
  beforeEach(() => vi.stubEnv("ADMIN_HOST", "admin.localhost:3001"));
  afterEach(() => vi.unstubAllEnvs());

  it("knows the admin host and the admin paths", () => {
    expect(isAdminRequest(new Headers({ host: "ADMIN.localhost:3001" }))).toBe(true);
    expect(isAdminRequest(new Headers({ host: "localhost:3001" }))).toBe(false);
    expect(isAdminRequest(new Headers({ host: "admin.localhost:3001" }), {})).toBe(false); // unset: no panel
    expect(isAdminPath("/fa/admin")).toBe(true);
    expect(isAdminPath("/en/admin/listings/4")).toBe(true);
    expect(isAdminPath("/admin-api/login")).toBe(true);
    expect(isAdminPath("/fa/administrator")).toBe(false);
    expect(isAdminPath("/fa/host")).toBe(false);
  });

  it("serves no admin page or handler on the public host", () => {
    for (const path of [
      "/fa/admin",
      "/en/admin/listings/4",
      "/admin-api/login",
      "/admin-api/api/v1/admin/listings/pending",
    ]) {
      expect(proxy(at(`http://localhost:3001${path}`, "localhost:3001")).status, path).toBe(404);
    }
  });

  it("on the admin host, opens the queue and serves nothing of the public site", () => {
    const home = proxy(at("http://admin.localhost:3001/", "admin.localhost:3001"));
    expect(home.status).toBe(307);
    expect(home.headers.get("location")).toBe("http://admin.localhost:3001/fa/admin");
    expect(proxy(at("http://admin.localhost:3001/en", "admin.localhost:3001")).headers.get("location")).toBe(
      "http://admin.localhost:3001/en/admin",
    );
    for (const path of ["/fa/search", "/fa/host", "/api/v1/me", "/session/login"]) {
      expect(proxy(at(`http://admin.localhost:3001${path}`, "admin.localhost:3001")).status, path).toBe(404);
    }
    expect(proxy(at("http://admin.localhost:3001/admin-api/login", "admin.localhost:3001")).status).toBe(200);
    const page = proxy(at("http://admin.localhost:3001/fa/admin", "admin.localhost:3001"));
    expect(page.status).toBe(200);
    expect(page.headers.get("content-security-policy")).toContain("nonce-");
  });

  it("redirects to the admin host the browser used, even when the server sees another address", () => {
    const res = proxy(new NextRequest("http://web:3001/", { headers: { host: "admin.localhost:3001" } }));
    expect(new URL(res.headers.get("location")!).host).toBe("admin.localhost:3001");
  });

  it("has no panel at all when ADMIN_HOST is not set", () => {
    vi.stubEnv("ADMIN_HOST", "");
    expect(proxy(at("http://localhost:3001/fa/admin", "localhost:3001")).status).toBe(404);
  });
});
