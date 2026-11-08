import { amenityCategoryName, amenityName, cityName, countryName } from "./names";

const messages: Record<string, string> = {
  "cities.Tehran": "تهران",
  "amenities.Wifi": "وای‌فای",
  "amenityCategories.Family": "خانواده",
};
const t = Object.assign((k: string) => messages[k] ?? k, { has: (k: string) => k in messages });

describe("catalog names", () => {
  it("translates known names and keeps unknown ones", () => {
    expect(cityName(t, "Tehran")).toBe("تهران");
    expect(cityName(t, "Tabriz")).toBe("Tabriz");
    expect(amenityName(t, "Wifi")).toBe("وای‌فای");
    expect(amenityName(t, "Pool")).toBe("Pool");
    expect(amenityCategoryName(t, "Family")).toBe("خانواده");
    expect(amenityCategoryName(t, "Other")).toBe("Other");
  });

  it("names countries with Intl", () => {
    expect(countryName("SE", "fa")).toBe("سوئد");
    expect(countryName("SE", "en")).toBe("Sweden");
    expect(countryName("!!", "en")).toBe("!!");
  });
});
