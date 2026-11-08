import { NextRequest } from "next/server";
import { proxy } from "./proxy";

describe("proxy", () => {
  it("refuses the API's auth routes, so log-in goes only through /session (research R19)", async () => {
    const response = proxy(new NextRequest("http://localhost:3001/api/v1/auth/login", { method: "POST" }));
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("not_found");
  });

  it("lets other API paths through untouched", () => {
    const response = proxy(new NextRequest("http://localhost:3001/api/v1/search/listings"));
    expect(response.headers.get("content-security-policy")).toBeNull();
    expect(response.status).toBe(200);
  });

  it("sends an address without a language to /fa", () => {
    const response = proxy(new NextRequest("http://localhost:3001/search?city_id=1"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3001/fa/search?city_id=1");
  });

  it("puts a fresh nonce policy on every page and passes it to the render", () => {
    const first = proxy(new NextRequest("http://localhost:3001/fa"));
    const second = proxy(new NextRequest("http://localhost:3001/en/search"));
    const csp = first.headers.get("content-security-policy")!;
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(second.headers.get("content-security-policy")).not.toBe(csp);
    const nonce = /'nonce-([^']+)'/.exec(csp)![1]!;
    expect(first.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
  });
});
