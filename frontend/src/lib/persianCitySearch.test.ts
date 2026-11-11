import { hasPersian, normalizePersian, persianCityMatches } from "./persianCitySearch";

describe("Persian city search (feature 028)", () => {
  it("tells Persian typing from Latin", () => {
    expect(hasPersian("تهر")).toBe(true);
    expect(hasPersian("Teh")).toBe(false);
    expect(hasPersian("  ")).toBe(false);
  });

  it("writes the same word one way, whatever the keyboard", () => {
    expect(normalizePersian("كپنهاگ")).toBe(normalizePersian("کپنهاگ")); // Arabic kaf
    expect(normalizePersian("شيراز")).toBe(normalizePersian("شیراز")); // Arabic yeh
    expect(normalizePersian("امستردام")).toBe(normalizePersian("آمستردام")); // alef without madda
    expect(normalizePersian("نیو‌یورک")).toBe(normalizePersian("نیویورک")); // half-space
    expect(normalizePersian("نیو یورک")).toBe(normalizePersian("نیویورک"));
  });

  it("finds the English names of the cities whose Persian name starts with the text", () => {
    expect(persianCityMatches("تهر")).toEqual(["Tehran"]);
    expect(persianCityMatches("ش")).toEqual(["Shiraz"]);
    expect(persianCityMatches("ا")).toEqual(["Amsterdam", "Stockholm", "Isfahan"]); // آمستردام, استکهلم, اصفهان
    expect(persianCityMatches("ل")).toEqual(["London", "Lisbon"]);
    expect(persianCityMatches("نیو یو")).toEqual(["New York City"]);
    expect(persianCityMatches("شيراز")).toEqual(["Shiraz"]);
    expect(persianCityMatches("اصفهانی")).toEqual([]);
    expect(persianCityMatches("")).toEqual([]);
  });

  it("keeps at most `limit` names", () => {
    expect(persianCityMatches("ا", 2)).toHaveLength(2);
  });
});
