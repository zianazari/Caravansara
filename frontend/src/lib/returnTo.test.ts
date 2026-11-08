import { safeReturnTo } from "./returnTo";

describe("safeReturnTo", () => {
  it("keeps paths inside the site, without the language prefix", () => {
    expect(safeReturnTo("/listings/12?adults=2")).toBe("/listings/12?adults=2");
    expect(safeReturnTo("/fa/listings/12?adults=2")).toBe("/listings/12?adults=2");
    expect(safeReturnTo("/en/trips")).toBe("/trips");
    expect(safeReturnTo("/en")).toBe("/");
    expect(safeReturnTo("/fa?x=1")).toBe("/?x=1");
  });

  it("sends everything else home", () => {
    for (const bad of [
      null,
      "",
      "https://evil.example",
      "//evil.example/fa",
      "/\\evil.example",
      "javascript:alert(1)",
      "%2F%2Fevil.example",
      "/%2F%2Fevil.example",
      "/%5Cevil.example",
      "/fa\u0000/x",
      "%E0%A4%A",
    ]) {
      expect(safeReturnTo(bad)).toBe("/");
    }
  });
});
