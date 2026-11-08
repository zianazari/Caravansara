import { PAGE_SIZE, hasArea, parseSearch, stayQuery, toApiQuery, toQuery } from "./searchParams";

describe("search state in the address", () => {
  it("round-trips a city search with dates, guests and amenities", () => {
    const query =
      "city_id=3&check_in=2026-12-01&check_out=2026-12-05&adults=2&children=1&infants=1&pets=1&amenity_ids=7&amenity_ids=2&offset=40";
    const state = parseSearch(new URLSearchParams(query));
    expect(state).toMatchObject({
      city_id: 3,
      adults: 2,
      children: 1,
      infants: 1,
      pets: 1,
      amenity_ids: [2, 7],
      offset: 40,
    });
    expect(parseSearch(toQuery(state))).toEqual(state);
    expect(hasArea(state)).toBe(true);
  });

  it("round-trips a radius search sorted by distance", () => {
    const state = parseSearch({ lat: "52.3702", lng: "4.8952", radius_km: "3", sort: "distance" });
    expect(state).toMatchObject({ lat: 52.3702, lng: 4.8952, radius_km: 3, sort: "distance" });
    expect(parseSearch(toQuery(state))).toEqual(state);
  });

  it("prefers the city when both a city and a point are given", () => {
    const state = parseSearch({ city_id: "1", lat: "1", lng: "1" });
    expect(state.city_id).toBe(1);
    expect(state.lat).toBeUndefined();
  });

  it("moves wrong values to the nearest allowed one, or drops them", () => {
    const state = parseSearch({
      lat: "10",
      lng: "10",
      radius_km: "500",
      adults: "0",
      children: "-2",
      pets: "x",
      amenity_ids: ["3", "3", "-1", "a"],
      offset: "45",
      check_in: "2026-12-05",
      check_out: "2026-12-01",
    });
    expect(state.radius_km).toBe(100);
    expect(state.adults).toBe(1);
    expect(state.children).toBe(0);
    expect(state.pets).toBe(0);
    expect(state.amenity_ids).toEqual([3]);
    expect(state.offset).toBe(40);
    expect(state.check_in).toBeUndefined();
    expect(parseSearch({ lat: "10", lng: "10", radius_km: "0.2" }).radius_km).toBe(1);
  });

  it("needs both dates, in YYYY-MM-DD", () => {
    expect(parseSearch({ check_in: "2026-12-01" }).check_in).toBeUndefined();
    expect(parseSearch({ check_in: "1/12/2026", check_out: "5/12/2026" }).check_in).toBeUndefined();
  });

  it("ignores distance sorting and bad points outside a radius search", () => {
    expect(parseSearch({ city_id: "1", sort: "distance" }).sort).toBe("rating");
    expect(hasArea(parseSearch({ lat: "95", lng: "10" }))).toBe(false);
    expect(hasArea(parseSearch({}))).toBe(false);
  });

  it("builds the API query and the stay part", () => {
    const state = parseSearch({ city_id: "2", adults: "2", check_in: "2026-12-01", check_out: "2026-12-03" });
    expect(toApiQuery(state)).toMatchObject({
      city_id: 2,
      adults: 2,
      limit: PAGE_SIZE,
      offset: 0,
      sort: "rating",
    });
    expect(stayQuery(state).toString()).toBe("check_in=2026-12-01&check_out=2026-12-03&adults=2");
    expect(stayQuery({ adults: 1, children: 2, infants: 1, pets: 1 }).toString()).toBe(
      "adults=1&children=2&infants=1&pets=1",
    );
    expect(toQuery(parseSearch({ adults: "1" })).toString()).toBe("adults=1");
  });
});
