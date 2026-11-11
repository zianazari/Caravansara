import { ROAD, STOPS, journeyAt, mirror } from "./heroJourney";

describe("the hero car's trip (feature 041)", () => {
  it("starts at the beginning of the road and ends parked at the city", () => {
    expect(journeyAt(0)).toEqual({ x: ROAD.start, parkedAt: null });
    expect(journeyAt(1)).toEqual({ x: STOPS[1], parkedAt: 1 });
    expect(journeyAt(-1)).toEqual(journeyAt(0)); // above the top
    expect(journeyAt(5)).toEqual(journeyAt(1)); // far below the hero
  });

  it("drives, waits at the caravansara, drives on, and waits at the city", () => {
    expect(journeyAt(0.2).parkedAt).toBeNull();
    expect(journeyAt(0.42)).toEqual({ x: STOPS[0], parkedAt: 0 });
    expect(journeyAt(0.7).parkedAt).toBeNull();
    expect(journeyAt(0.95)).toEqual({ x: STOPS[1], parkedAt: 1 });
  });

  it("only ever moves forward as the visitor scrolls down", () => {
    let last = -Infinity;
    for (let p = 0; p <= 1; p += 0.01) {
      const { x } = journeyAt(p);
      expect(x).toBeGreaterThanOrEqual(last);
      last = x;
    }
  });

  it("mirrors the road for the right-to-left Persian site", () => {
    expect(mirror(100, true)).toBe(900);
    expect(mirror(100, false)).toBe(100);
  });
});
