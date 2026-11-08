/**
 * The search, kept in the address (FR-020; data-model, "Search state"): a search link can be shared, and the
 * browser's Back button returns to the previous search. Names match the API's query parameters (FR-016).
 * A wrong value in a hand-edited address is moved to the nearest allowed value or dropped, never an error.
 */
export const PAGE_SIZE = 20;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export type SearchState = {
  city_id?: number;
  lat?: number;
  lng?: number;
  radius_km?: number;
  check_in?: string;
  check_out?: string;
  adults: number;
  children: number;
  infants: number;
  pets: number;
  amenity_ids: number[];
  sort: "rating" | "distance";
  offset: number;
};

type Query = Record<string, string | string[] | undefined> | URLSearchParams;

function all(query: Query, key: string): string[] {
  if (query instanceof URLSearchParams) return query.getAll(key);
  const value = query[key];
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

const first = (query: Query, key: string) => all(query, key)[0];

function num(text: string | undefined): number | undefined {
  if (text === undefined || text.trim() === "") return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

function int(text: string | undefined, min: number, max: number, fallback: number): number {
  const value = num(text);
  if (value === undefined || !Number.isInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function parseSearch(query: Query): SearchState {
  const state: SearchState = {
    adults: int(first(query, "adults"), 1, 50, 1),
    children: int(first(query, "children"), 0, 50, 0),
    infants: int(first(query, "infants"), 0, 10, 0),
    pets: int(first(query, "pets"), 0, 10, 0),
    amenity_ids: [
      ...new Set(
        all(query, "amenity_ids")
          .map(num)
          .filter((v): v is number => v !== undefined && Number.isInteger(v) && v > 0),
      ),
    ].sort((a, b) => a - b),
    sort: "rating",
    offset: 0,
  };

  const cityId = num(first(query, "city_id"));
  const lat = num(first(query, "lat"));
  const lng = num(first(query, "lng"));
  if (cityId !== undefined && Number.isInteger(cityId) && cityId > 0) {
    state.city_id = cityId;
  } else if (lat !== undefined && lng !== undefined && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    state.lat = lat;
    state.lng = lng;
    state.radius_km = clamp(num(first(query, "radius_km")) ?? 5, 1, 100);
    if (first(query, "sort") === "distance") state.sort = "distance";
  }

  const checkIn = first(query, "check_in");
  const checkOut = first(query, "check_out");
  if (checkIn && checkOut && ISO.test(checkIn) && ISO.test(checkOut) && checkOut > checkIn) {
    state.check_in = checkIn;
    state.check_out = checkOut;
  }

  const offset = int(first(query, "offset"), 0, 1_000_000, 0);
  state.offset = offset - (offset % PAGE_SIZE);
  return state;
}

export function hasArea(state: SearchState): boolean {
  return state.city_id !== undefined || state.lat !== undefined;
}

/** The address query for a search; defaults are left out so links stay short. */
export function toQuery(state: SearchState): URLSearchParams {
  const q = new URLSearchParams();
  if (state.city_id !== undefined) q.set("city_id", String(state.city_id));
  if (state.lat !== undefined && state.lng !== undefined) {
    q.set("lat", state.lat.toFixed(5));
    q.set("lng", state.lng.toFixed(5));
    q.set("radius_km", String(state.radius_km ?? 5));
  }
  if (state.check_in && state.check_out) {
    q.set("check_in", state.check_in);
    q.set("check_out", state.check_out);
  }
  q.set("adults", String(state.adults));
  if (state.children) q.set("children", String(state.children));
  if (state.infants) q.set("infants", String(state.infants));
  if (state.pets) q.set("pets", String(state.pets));
  for (const id of state.amenity_ids) q.append("amenity_ids", String(id));
  if (state.sort === "distance" && state.lat !== undefined) q.set("sort", "distance");
  if (state.offset) q.set("offset", String(state.offset));
  return q;
}

/** The same search as API query parameters. */
export function toApiQuery(state: SearchState) {
  return {
    city_id: state.city_id,
    lat: state.lat,
    lng: state.lng,
    radius_km: state.radius_km,
    check_in: state.check_in,
    check_out: state.check_out,
    adults: state.adults,
    children: state.children,
    infants: state.infants,
    pets: state.pets,
    amenity_ids: state.amenity_ids,
    sort: state.sort,
    limit: PAGE_SIZE,
    offset: state.offset,
  };
}

/** Only the stay part (dates and guests), carried from a result to the listing page and the booking. */
export function stayQuery(
  state: Pick<SearchState, "check_in" | "check_out" | "adults" | "children" | "infants" | "pets">,
) {
  const q = new URLSearchParams();
  if (state.check_in && state.check_out) {
    q.set("check_in", state.check_in);
    q.set("check_out", state.check_out);
  }
  q.set("adults", String(state.adults));
  if (state.children) q.set("children", String(state.children));
  if (state.infants) q.set("infants", String(state.infants));
  if (state.pets) q.set("pets", String(state.pets));
  return q;
}
