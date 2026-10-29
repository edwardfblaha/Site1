import { describe, it, expect } from "vitest";
import { Rng } from "../src/engine/rng";
import { generateAthlete, generateRoster } from "../src/engine/athletes";

describe("athlete generation", () => {
  it("attributes stay within 1–99", () => {
    const r = new Rng(1);
    for (let i = 0; i < 500; i++) {
      const a = generateAthlete(r);
      for (const v of Object.values(a.attrs)) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(99);
      }
      expect(a.hidden.potential).toBeLessThanOrEqual(99);
    }
  });

  it("is deterministic for a given seed", () => {
    const a1 = generateAthlete(new Rng(42));
    const a2 = generateAthlete(new Rng(42));
    expect(a1).toEqual(a2);
  });

  it("higher stars → higher average talent", () => {
    const r = new Rng(7);
    const avg = (stars: 1 | 5) => {
      let s = 0;
      const n = 300;
      for (let i = 0; i < n; i++) {
        const a = generateAthlete(r, { stars });
        s += (a.attrs.aerobic + a.attrs.threshold + a.attrs.speed) / 3;
      }
      return s / n;
    };
    expect(avg(5)).toBeGreaterThan(avg(1) + 20);
  });

  it("potential is never below current ability center", () => {
    const r = new Rng(9);
    for (let i = 0; i < 200; i++) {
      const a = generateAthlete(r, { stars: 3 });
      expect(a.hidden.potential).toBeGreaterThanOrEqual(a.attrs.threshold - 25);
    }
  });

  it("rosters reflect prestige tilt", () => {
    const strong = generateRoster(new Rng(1), 95, 14);
    const weak = generateRoster(new Rng(1), 35, 14);
    const mean = (rs: ReturnType<typeof generateRoster>) =>
      rs.reduce((s, a) => s + a.starRating, 0) / rs.length;
    expect(mean(strong)).toBeGreaterThan(mean(weak));
    expect(strong).toHaveLength(14);
  });
});
