import { contentSecurityPolicy, makeNonce } from "./csp";
import { originOf } from "./env";

describe("content security policy (research R21)", () => {
  it("makes a new random nonce every time", () => {
    const a = makeNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(makeNonce()).not.toBe(a);
  });

  it("allows only nonce scripts, own storage and map tiles", () => {
    const csp = contentSecurityPolicy("abc", false);
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("img-src 'self' data: blob: http://localhost:9000 https://tile.openstreetmap.org");
    expect(csp).toContain("connect-src 'self' http://localhost:9000 https://tile.openstreetmap.org");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("worker-src 'self' blob:");
  });

  it("allows eval only in development", () => {
    expect(contentSecurityPolicy("abc", true)).toContain("'strict-dynamic' 'unsafe-eval'");
  });

  it("reads the origin of a URL template", () => {
    expect(originOf("https://tile.openstreetmap.org/{z}/{x}/{y}.png")).toBe("https://tile.openstreetmap.org");
  });
});
