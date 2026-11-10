import { AlarmSmoke, Check, Siren, Wifi } from "lucide-react";
import { amenityIcon } from "./amenityIcons";

const CATALOG = [
  "droplet",
  "bottle",
  "hair-dryer",
  "iron",
  "bed",
  "dryer",
  "washer",
  "tv",
  "chair",
  "baby-bed",
  "snowflake",
  "flame",
  "first-aid",
  "fire-extinguisher",
  "alarm",
  "desk",
  "wifi",
  "pan",
  "coffee",
  "dishwasher",
  "microwave",
  "fridge",
  "kitchen",
  "water",
  "sauna",
  "balcony",
  "hot-tub",
  "elevator",
  "parking",
  "key",
]; // every icon name in the amenity catalog (db seed), 2026-11-10

describe("amenityIcon (feature 018)", () => {
  it("has its own icon for every amenity in the catalog", () => {
    for (const icon of CATALOG) expect(amenityIcon({ name: "x", icon }), icon).not.toBe(Check);
  });

  it("tells the two alarms apart, and falls back to a check mark", () => {
    expect(amenityIcon({ name: "Smoke alarm", icon: "alarm" })).toBe(AlarmSmoke);
    expect(amenityIcon({ name: "Carbon monoxide alarm", icon: "alarm" })).toBe(Siren);
    expect(amenityIcon({ name: "Wifi", icon: "wifi" })).toBe(Wifi);
    expect(amenityIcon({ name: "New thing", icon: "unknown" })).toBe(Check);
    expect(amenityIcon({ name: "No icon", icon: null })).toBe(Check);
  });
});
