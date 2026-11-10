import {
  AlarmSmoke,
  ArrowUpDown,
  Armchair,
  Baby,
  Bath,
  Bed,
  BriefcaseMedical,
  Check,
  CircleParking,
  Coffee,
  CookingPot,
  Droplet,
  Fan,
  Fence,
  FireExtinguisher,
  FlaskConical,
  Heater,
  KeyRound,
  Laptop,
  Microwave,
  Refrigerator,
  Shirt,
  Siren,
  Snowflake,
  Sparkles,
  ThermometerSun,
  Tv,
  Utensils,
  WashingMachine,
  Waves,
  Wifi,
  Wind,
  type LucideIcon,
} from "lucide-react";

/**
 * An icon for each amenity (feature 018): line icons from Lucide (ISC licence, already in the project), in the
 * style people know from booking sites. Keyed by the API's `icon` name (catalog seed); an unknown or missing
 * name gets a plain check mark, so a new amenity never breaks the page. Airbnb's own icons are not copied:
 * they are that company's artwork.
 */
const BY_ICON: Record<string, LucideIcon> = {
  droplet: Droplet,
  bottle: FlaskConical,
  "hair-dryer": Wind,
  iron: Shirt,
  bed: Bed,
  dryer: Fan,
  washer: WashingMachine,
  tv: Tv,
  chair: Armchair,
  "baby-bed": Baby,
  snowflake: Snowflake,
  flame: Heater,
  "first-aid": BriefcaseMedical,
  "fire-extinguisher": FireExtinguisher,
  alarm: AlarmSmoke,
  desk: Laptop,
  wifi: Wifi,
  pan: CookingPot,
  coffee: Coffee,
  dishwasher: Sparkles,
  microwave: Microwave,
  fridge: Refrigerator,
  kitchen: Utensils,
  water: Waves,
  sauna: ThermometerSun,
  balcony: Fence,
  "hot-tub": Bath,
  elevator: ArrowUpDown,
  parking: CircleParking,
  key: KeyRound,
};

/** Two amenities share the "alarm" icon name; the carbon monoxide alarm gets its own picture. */
const BY_NAME: Record<string, LucideIcon> = { "Carbon monoxide alarm": Siren };

export function amenityIcon(amenity: { name: string; icon?: string | null }): LucideIcon {
  return BY_NAME[amenity.name] ?? (amenity.icon ? BY_ICON[amenity.icon] : undefined) ?? Check;
}
