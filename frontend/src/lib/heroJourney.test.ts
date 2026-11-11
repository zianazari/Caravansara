import { PARK_X, START, STOPS, WORLD, VIEW, journeyAt } from "./heroJourney";

describe("the hero car's trip (features 041, 041b)", () => {
  it("has six places: garden, villa, caravansara, apartment, cabin and eco-lodge", () => {
    expect(STOPS).toEqual(["garden", "villa", "caravansara", "apartment", "cabin", "ecolodge"]);
  });

  it("starts at the beginning of the road and ends parked at the last place", () => {
    expect(journeyAt(0)).toMatchObject({ x: START, parkedAt: null, camera: 0 });
    expect(journeyAt(1)).toMatchObject({ x: PARK_X[5], parkedAt: 5 });
    expect(journeyAt(-1)).toEqual(journeyAt(0));
    expect(journeyAt(5)).toEqual(journeyAt(1));
  });

  it("drives to each place, then rests there for half of its share", () => {
    const share = 1 / STOPS.length;
    STOPS.forEach((_, i) => {
      expect(journeyAt(i * share + share * 0.25).parkedAt).toBeNull();
      expect(journeyAt(i * share + share * 0.75)).toMatchObject({ x: PARK_X[i], parkedAt: i });
    });
  });

  it("only moves forward as the visitor scrolls down, and the camera follows inside the world", () => {
    let last = -Infinity;
    for (let p = 0; p <= 1; p += 0.005) {
      const { x, camera } = journeyAt(p);
      expect(x).toBeGreaterThanOrEqual(last);
      expect(camera).toBeGreaterThanOrEqual(0);
      expect(camera).toBeLessThanOrEqual(WORLD - VIEW);
      expect(x - camera).toBeGreaterThanOrEqual(0); // the car is always in view
      expect(x - camera).toBeLessThanOrEqual(VIEW);
      last = x;
    }
  });
});
