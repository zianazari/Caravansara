/**
 * The car's trip in the home page's hero (features 041, 041b): as the visitor scrolls, a car with three
 * passengers drives along a road and stops at one place after another: a garden, a villa, a caravansara, an
 * apartment block, a forest cabin and an eco-lodge. This is the pure part: for a given progress (0 when the
 * story starts, 1 when it ends) where the car is, whether it is parked and where, and where the "camera" looks,
 * in the scene's own units (a view 1000 wide; the world is longer and pans with the car). Keeping it here makes
 * it testable without a browser.
 */

/** The places, in the order the car reaches them. */
export const STOPS = ["garden", "villa", "caravansara", "apartment", "cabin", "ecolodge"] as const;
export type StopKind = (typeof STOPS)[number];

/** Where the car starts, and how far apart the places are along the road. */
export const START = 120;
export const SPACING = 430;
/** Where the car parks for each place; the place itself stands just ahead of it (PLACE_AHEAD). */
export const PARK_X = STOPS.map((_, i) => START + 330 + i * SPACING);
export const PLACE_AHEAD = 215;
/** The end of the world: the last place and some road after it. */
export const WORLD = PARK_X[PARK_X.length - 1]! + 600;
/** The view is 1000 wide; the car stays a little behind its middle, so the place ahead is in view. */
export const VIEW = 1000;
const CAR_IN_VIEW = 360;

/** Soft start and stop of each drive, so the car pulls away and brakes rather than jerks. */
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

export type JourneyPoint = {
  /** The car's position along the road, in world units (left to right, before any mirroring). */
  x: number;
  /** Which place the car is parked at (an index into STOPS), or null while it drives. */
  parkedAt: number | null;
  /** The left edge of the view in world units: the camera follows the car. */
  camera: number;
};

/**
 * Each place gets an equal share of the progress: the first half of the share drives there, the second half
 * waits there, so the car visibly rests at every place for a good stretch of scrolling.
 */
export function journeyAt(progress: number): JourneyPoint {
  const p = Math.min(1, Math.max(0, progress));
  const share = 1 / STOPS.length;
  const index = Math.min(STOPS.length - 1, Math.floor(p / share));
  const into = (p - index * share) / share; // 0..1 within this place's share
  const from = index === 0 ? START : PARK_X[index - 1]!;
  const to = PARK_X[index]!;
  const driving = into < 0.5;
  const x = driving ? from + (to - from) * smooth(into / 0.5) : to;
  const camera = Math.min(WORLD - VIEW, Math.max(0, x - CAR_IN_VIEW));
  return { x, parkedAt: driving ? null : index, camera };
}
