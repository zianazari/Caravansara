import { activeCategory, categoriesFor, filterOf } from "./categories";

const groups = [
  {
    id: 1,
    name: "Outdoor",
    amenities: [
      { id: 26, name: "Sauna", icon: "sauna" },
      { id: 27, name: "Balcony", icon: "b" },
    ],
  },
  { id: 2, name: "Kitchen and dining", amenities: [{ id: 24, name: "Kitchen", icon: "k" }] },
];

describe("categories (specs/007-caravansara-theme, FR-014, research R5)", () => {
  it("always offers all, the place types and pets, and only the amenities the list has", () => {
    expect(categoriesFor(groups).map((c) => c.key)).toEqual([
      "all",
      "entire_place",
      "private_room",
      "shared_room",
      "pets",
      "sauna",
      "balcony",
      "kitchen",
    ]);
  });

  it("offers all, the place types and pets even before the amenity list arrives", () => {
    expect(categoriesFor(undefined).map((c) => c.key)).toEqual([
      "all",
      "entire_place",
      "private_room",
      "shared_room",
      "pets",
    ]);
  });

  it("turns a category into the search's own filters", () => {
    expect(filterOf("all", groups)).toEqual({});
    expect(filterOf("pets", groups)).toEqual({ pets: 1 });
    expect(filterOf("sauna", groups)).toEqual({ amenity_ids: [26] });
    expect(filterOf("hot_tub", groups)).toEqual({});
    expect(filterOf("private_room", groups)).toEqual({ property_type: "private_room" }); // feature 015
  });

  it("reads an unknown key in the address as all", () => {
    expect(activeCategory("nonsense", groups)).toBe("all");
    expect(activeCategory(null, groups)).toBe("all");
    expect(activeCategory("hot_tub", groups)).toBe("all"); // not in this list
    expect(activeCategory("sauna", groups)).toBe("sauna");
  });
});
