import type { components } from "@/api/schema";
import { errorCode, fieldErrors, type ApiErrorBody } from "./errors";
import type { ListingDraft } from "./listingDraft";
import { MAX_AMOUNT, parseAmountInput, toHundredths, tomanToRial } from "./money";

type ListingCreate = components["schemas"]["ListingCreate"];

/**
 * The rules of the step-by-step listing form (specs/008-host-pages, data-model "Listing draft"), the same limits
 * as the API's ListingCreate, so a wrong answer is caught on its own step instead of after the last one. Kept
 * out of the step components so the steps, the final check and the mapping of the API's field errors all use
 * one table.
 */
export const STEPS = [
  "type",
  "location",
  "capacity",
  "amenities",
  "description",
  "price",
  "times",
  "photos",
] as const;
export type StepName = (typeof STEPS)[number];
export const STEP_COUNT = STEPS.length;

/** The fields each step asks for, in the order of data-model.md. */
export const STEP_FIELDS: Record<StepName, string[]> = {
  type: ["property_type"],
  location: ["city_id", "neighborhood", "address", "latitude", "longitude"],
  capacity: ["max_guests", "bedrooms", "beds", "bathrooms", "pets_allowed", "max_pets"],
  amenities: ["amenity_ids"],
  description: ["title", "description"],
  price: ["currency", "price_per_night", "cleaning_fee"],
  times: ["check_in_time", "check_out_time"],
  photos: [],
};

/** The 1-based step a field belongs to, or undefined for a name the form does not know. */
export function stepOfField(field: string): number | undefined {
  const index = STEPS.findIndex((step) => STEP_FIELDS[step].includes(field));
  return index < 0 ? undefined : index + 1;
}

/** A problem with one field: a message key under `wizard.` and its values. */
export type FieldProblem = { key: string; values?: Record<string, number> };

/** What a new form starts with: the usual answers, so a host only changes what differs. */
export const DRAFT_DEFAULTS: ListingDraft = {
  max_guests: 2,
  bedrooms: 1,
  beds: 1,
  bathrooms: 1,
  pets_allowed: false,
  max_pets: 0,
  amenity_ids: [],
  check_in_time: "15:00",
  check_out_time: "11:00",
};

/**
 * The currency a new listing starts with, from its city's country (research R7, analyze U1): the demo's
 * countries; any other country starts with euro. The host can change it.
 */
export function currencyFor(countryCode?: string): string {
  const byCountry: Record<string, string> = { IR: "IRR", GB: "GBP", SE: "SEK", DK: "DKK", US: "USD" };
  return (countryCode && byCountry[countryCode]) || "EUR";
}
export const CURRENCIES = ["IRR", "EUR", "GBP", "SEK", "DKK", "USD"] as const;

/**
 * A price as typed (toman for rial) to the API's amount, or the problem with it. `positive` is for the nightly
 * price, which must be above zero; a cleaning fee may be zero.
 */
export function priceForApi(
  text: string | undefined,
  currency: string,
  positive: boolean,
): { amount: string } | { problem: FieldProblem } {
  const parsed = parseAmountInput(text ?? "");
  if (parsed === null) return { problem: { key: text?.trim() ? "invalidNumber" : "required" } };
  const amount = currency === "IRR" ? tomanToRial(parsed) : parsed;
  if (amount === null || toHundredths(amount) > toHundredths(MAX_AMOUNT))
    return { problem: { key: "priceTooHigh" } };
  if (positive && toHundredths(amount) === 0n) return { problem: { key: "pricePositive" } };
  return { amount };
}

function whole(value: unknown, min: number, max: number): FieldProblem | undefined {
  if (value === undefined || value === null || value === "") return { key: "required" };
  if (typeof value !== "number" || !Number.isInteger(value)) return { key: "invalidNumber" };
  return value < min || value > max ? { key: "range", values: { min, max } } : undefined;
}

function decimalIn(value: unknown, min: number, max: number): FieldProblem | undefined {
  if (value === undefined || value === null || value === "") return { key: "required" };
  if (typeof value !== "number" || !Number.isFinite(value)) return { key: "invalidNumber" };
  return value < min || value > max ? { key: "range", values: { min, max } } : undefined;
}

function text(value: string | null | undefined, max: number, required: boolean): FieldProblem | undefined {
  const trimmed = (value ?? "").trim();
  if (required && !trimmed) return { key: "required" };
  return trimmed.length > max ? { key: "tooLong", values: { max } } : undefined;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The problems of one step's answers, by field; empty when the step can be left. */
export function validateStep(step: StepName, d: ListingDraft): Record<string, FieldProblem> {
  const out: Record<string, FieldProblem | undefined> = {};
  switch (step) {
    case "type":
      out.property_type = d.property_type ? undefined : { key: "required" };
      break;
    case "location":
      out.city_id = d.city_id ? undefined : { key: "required" };
      out.neighborhood = text(d.neighborhood, 100, false);
      out.address = text(d.address, 300, true);
      // One message for the pin: the two numbers are set together on the map.
      if (d.latitude === undefined || d.longitude === undefined) out.latitude = { key: "pinRequired" };
      else {
        out.latitude = decimalIn(d.latitude, -90, 90);
        out.longitude = decimalIn(d.longitude, -180, 180);
      }
      break;
    case "capacity":
      out.max_guests = whole(d.max_guests, 1, 50);
      out.bedrooms = whole(d.bedrooms, 0, 50);
      out.beds = whole(d.beds, 0, 100);
      out.bathrooms =
        decimalIn(d.bathrooms, 0, 50) ??
        (Number.isInteger((d.bathrooms as number) * 2) ? undefined : { key: "invalidNumber" });
      out.max_pets = d.pets_allowed ? whole(d.max_pets, 0, 10) : undefined;
      break;
    case "description":
      out.title = text(d.title, 200, true);
      out.description = text(d.description, 5000, false);
      break;
    case "price": {
      const currency = d.currency ?? "";
      out.currency = /^[A-Z]{3}$/.test(currency) ? undefined : { key: "required" };
      const night = priceForApi(d.price_per_night, currency, true);
      out.price_per_night = "problem" in night ? night.problem : undefined;
      if (d.cleaning_fee?.trim()) {
        const fee = priceForApi(d.cleaning_fee, currency, false);
        out.cleaning_fee = "problem" in fee ? fee.problem : undefined;
      }
      break;
    }
    case "times":
      out.check_in_time = TIME.test(d.check_in_time ?? "") ? undefined : { key: "required" };
      out.check_out_time = TIME.test(d.check_out_time ?? "") ? undefined : { key: "required" };
      break;
    case "amenities":
    case "photos":
      break;
  }
  return Object.fromEntries(Object.entries(out).filter(([, problem]) => problem)) as Record<
    string,
    FieldProblem
  >;
}

/** The first step (1-based) whose answers are not yet right, or undefined when steps 1 to 7 are all right. */
export function firstInvalidStep(d: ListingDraft): number | undefined {
  const index = STEPS.findIndex((step) => Object.keys(validateStep(step, d)).length > 0);
  return index < 0 ? undefined : index + 1;
}

/** The body of POST /listings from a draft that passed every step; prices in the API's unit. */
export function toListingCreate(d: ListingDraft): ListingCreate {
  const currency = d.currency!;
  const night = priceForApi(d.price_per_night, currency, true);
  const fee = d.cleaning_fee?.trim() ? priceForApi(d.cleaning_fee, currency, false) : { amount: "0.00" };
  if ("problem" in night || "problem" in fee) throw new Error("toListingCreate needs a checked draft");
  return {
    property_type: d.property_type!,
    city_id: d.city_id!,
    neighborhood: d.neighborhood?.trim() || null,
    address: d.address!.trim(),
    latitude: d.latitude!,
    longitude: d.longitude!,
    max_guests: d.max_guests!,
    bedrooms: d.bedrooms!,
    beds: d.beds!,
    bathrooms: d.bathrooms!,
    pets_allowed: d.pets_allowed ?? false,
    max_pets: d.pets_allowed ? (d.max_pets ?? 0) : 0,
    amenity_ids: d.amenity_ids ?? [],
    title: d.title!.trim(),
    description: d.description?.trim() || null,
    currency,
    price_per_night: night.amount,
    cleaning_fee: fee.amount,
    check_in_time: d.check_in_time!,
    check_out_time: d.check_out_time!,
  };
}

/**
 * The fields a `validation_error` names (FR-015): the API sends either a list of problems with their place
 * (`details: [{loc: ["body", "title"], type}]`) or, for its own checks, `details.fields: ["title"]`.
 */
export function apiFieldProblems(body: unknown): Record<string, string> {
  const out = fieldErrors(body);
  if (errorCode(body) === "validation_error") {
    const fields = ((body as ApiErrorBody).error.details as { fields?: unknown } | undefined)?.fields;
    if (Array.isArray(fields))
      for (const f of fields) if (typeof f === "string" && !(f in out)) out[f] = "invalid";
  }
  return out;
}
