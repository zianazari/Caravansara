import {
  apiFieldProblems,
  currencyFor,
  DRAFT_DEFAULTS,
  firstInvalidStep,
  priceForApi,
  stepOfField,
  toListingCreate,
  validateStep,
} from "./listingForm";

const full = {
  ...DRAFT_DEFAULTS,
  property_type: "entire_place" as const,
  city_id: 3,
  address: "Keizersgracht 1",
  latitude: 52.37,
  longitude: 4.89,
  title: "Canal house",
  currency: "IRR",
  price_per_night: "۱٬۲۰۰٬۰۰۰",
};

describe("listingForm (specs/008-host-pages, data-model)", () => {
  it("checks each step with the API's limits", () => {
    expect(validateStep("type", {})).toEqual({ property_type: { key: "required" } });
    expect(validateStep("description", { title: "x".repeat(201) })).toEqual({
      title: { key: "tooLong", values: { max: 200 } },
    });
    expect(validateStep("capacity", { ...DRAFT_DEFAULTS, max_guests: 0 })).toEqual({
      max_guests: { key: "range", values: { min: 1, max: 50 } },
    });
    expect(validateStep("capacity", { ...DRAFT_DEFAULTS, bathrooms: 1.3 })).toEqual({
      bathrooms: { key: "invalidNumber" },
    });
    expect(validateStep("capacity", { ...DRAFT_DEFAULTS, bathrooms: 1.5 })).toEqual({});
    expect(validateStep("location", { city_id: 1, address: "a" })).toEqual({
      latitude: { key: "pinRequired" },
    });
    expect(validateStep("capacity", { ...DRAFT_DEFAULTS, pets_allowed: true, max_pets: 11 })).toEqual({
      max_pets: { key: "range", values: { min: 0, max: 10 } },
    });
  });

  it("takes toman for rial and checks the limit after ×10 (R7)", () => {
    expect(priceForApi("۱۲۰٬۰۰۰", "IRR", true)).toEqual({ amount: "1200000.00" });
    expect(priceForApi("120", "EUR", true)).toEqual({ amount: "120" });
    expect(priceForApi("100000001", "IRR", true)).toEqual({ problem: { key: "priceTooHigh" } });
    expect(priceForApi("0", "EUR", true)).toEqual({ problem: { key: "pricePositive" } });
    expect(priceForApi("0", "EUR", false)).toEqual({ amount: "0" });
    expect(priceForApi("abc", "EUR", true)).toEqual({ problem: { key: "invalidNumber" } });
    expect(priceForApi("", "EUR", true)).toEqual({ problem: { key: "required" } });
  });

  it("starts the currency from the city's country", () => {
    expect(currencyFor("IR")).toBe("IRR");
    expect(currencyFor("GB")).toBe("GBP");
    expect(currencyFor("NL")).toBe("EUR");
    expect(currencyFor()).toBe("EUR");
  });

  it("finds the first unfinished step and builds the API body", () => {
    expect(firstInvalidStep({})).toBe(1);
    expect(firstInvalidStep({ ...full, title: "" })).toBe(5);
    expect(firstInvalidStep(full)).toBeUndefined();
    expect(toListingCreate(full)).toMatchObject({
      price_per_night: "12000000.00",
      cleaning_fee: "0.00",
      neighborhood: null,
      description: null,
      max_pets: 0,
      amenity_ids: [],
    });
  });

  it("maps the API's field names to their steps (FR-015)", () => {
    expect(stepOfField("title")).toBe(5);
    expect(stepOfField("latitude")).toBe(2);
    expect(stepOfField("nothing")).toBeUndefined();
    expect(
      apiFieldProblems({
        error: { code: "validation_error", details: [{ loc: ["body", "title"], type: "string_too_long" }] },
      }),
    ).toEqual({ title: "string_too_long" });
    expect(
      apiFieldProblems({ error: { code: "validation_error", details: { fields: ["address"] } } }),
    ).toEqual({
      address: "invalid",
    });
    expect(apiFieldProblems({ error: { code: "listing_not_found" } })).toEqual({});
  });
});
