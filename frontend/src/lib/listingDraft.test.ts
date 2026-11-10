import { clearListingDraft, readListingDraft, saveListingDraft } from "./listingDraft";

describe("listing draft (specs/008-host-pages, research R2)", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("keeps each step's answers in this tab until it is cleared", () => {
    expect(readListingDraft()).toEqual({});
    saveListingDraft({ property_type: "entire_place" });
    saveListingDraft({ city_id: 7, address: "Valiasr 1" });
    expect(readListingDraft()).toEqual({ property_type: "entire_place", city_id: 7, address: "Valiasr 1" });
    expect(window.sessionStorage.getItem("cv-listing-draft")).toContain("Valiasr 1");
    clearListingDraft();
    expect(readListingDraft()).toEqual({});
  });

  it("ignores a broken draft", () => {
    window.sessionStorage.setItem("cv-listing-draft", "{not json");
    expect(readListingDraft()).toEqual({});
    window.sessionStorage.setItem("cv-listing-draft", '["a list"]');
    expect(readListingDraft()).toEqual({});
  });

  it("works on this page alone when the browser has no storage", () => {
    const spy = vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new Error("blocked");
    });
    saveListingDraft({ title: "Garden flat" });
    expect(readListingDraft()).toEqual({ title: "Garden flat" });
    clearListingDraft();
    expect(readListingDraft()).toEqual({});
    spy.mockRestore();
  });
});
