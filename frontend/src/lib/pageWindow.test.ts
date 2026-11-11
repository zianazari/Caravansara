import { lastPage, pageWindow, parsePage } from "./pageWindow";

describe("pageWindow (feature 025)", () => {
  it("shows every page when they fit", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(5, 12)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("keeps the first and last page and at most 10 between them", () => {
    expect(pageWindow(1, 50)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, "gap", 50]);
    expect(pageWindow(25, 50)).toEqual([1, "gap", 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, "gap", 50]);
    expect(pageWindow(50, 50)).toEqual([1, "gap", 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50]);
    for (let page = 1; page <= 50; page += 1) {
      const middle = pageWindow(page, 50).filter((s) => s !== "gap" && s !== 1 && s !== 50);
      expect(middle.length).toBe(10);
      expect(middle).toContain(page === 1 || page === 50 ? middle[0] : page);
    }
  });

  it("has no gap where only one page would be left out", () => {
    expect(pageWindow(1, 13)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, "gap", 13]);
    expect(pageWindow(13, 13)).toEqual([1, "gap", 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it("clamps a page outside the range", () => {
    expect(pageWindow(99, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(0, 3)).toEqual([1, 2, 3]);
  });

  it("counts pages and reads them from the address bar", () => {
    expect(lastPage(0, 20)).toBe(1);
    expect(lastPage(20, 20)).toBe(1);
    expect(lastPage(21, 20)).toBe(2);
    expect(parsePage("3")).toBe(3);
    for (const bad of [null, "", "0", "-2", "1.5", "x"]) expect(parsePage(bad)).toBe(1);
  });
});
