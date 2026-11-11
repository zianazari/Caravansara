/**
 * The car's trip in the home page's hero (feature 041, owner's request): as the visitor scrolls down, a car
 * with three passengers drives along the road, stops at a caravansara, drives on and stops at a city. This is
 * the pure part: where the car is for a given progress (0 at the top of the page, 1 once the hero has mostly
 * scrolled away), in the scene's own units (a road 1000 wide). The component maps scroll to progress and
 * draws; keeping the route here makes it testable without a browser.
 */

/** The road, from the start to the far end, in scene units. */
export const ROAD = { start: 90, end: 1000 } as const;
/** Where the car parks at each destination: before the caravansara gate, then before the city. */
export const STOPS = [455, 835] as const;

/**
 * Progress at which each leg starts and ends: drive, wait, drive, wait. Each wait is a quarter of the trip or
 * more, so the car visibly rests at a destination for a good stretch of scrolling, not a moment.
 */
const LEGS = [
  { from: 0, to: 0.3, x0: ROAD.start, x1: STOPS[0] },
  { from: 0.3, to: 0.55, x0: STOPS[0], x1: STOPS[0] },
  { from: 0.55, to: 0.8, x0: STOPS[0], x1: STOPS[1] },
  { from: 0.8, to: 1, x0: STOPS[1], x1: STOPS[1] },
] as const;

/** Soft start and stop of each drive, so the car pulls away and brakes rather than jerks. */
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

export type JourneyPoint = {
  /** The car's position along the road, in scene units (before any right-to-left mirroring). */
  x: number;
  /** Which destination the car is parked at (0 or 1), or null while it drives. */
  parkedAt: 0 | 1 | null;
};

export function journeyAt(progress: number): JourneyPoint {
  const p = Math.min(1, Math.max(0, progress));
  const leg = LEGS.find((l) => p <= l.to) ?? LEGS[LEGS.length - 1]!;
  const t = leg.to === leg.from ? 1 : (p - leg.from) / (leg.to - leg.from);
  const x = leg.x0 + (leg.x1 - leg.x0) * smooth(t);
  const parkedAt = leg.x0 === leg.x1 ? (leg.x0 === STOPS[0] ? 0 : 1) : null;
  return { x, parkedAt };
}

/** A position in a right-to-left scene: the road is drawn from the right edge on the Persian site. */
export function mirror(x: number, rtl: boolean): number {
  return rtl ? 1000 - x : x;
}
