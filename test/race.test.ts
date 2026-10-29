import { describe, it, expect } from "vitest";
import { Rng } from "../src/engine/rng";
import { generateAthlete, generateRoster } from "../src/engine/athletes";
import { simulateRace, type RaceEntrant } from "../src/engine/race";
import { simulateMeet } from "../src/engine/meet";
import type { CourseProfile, Meet, Athlete } from "../src/engine/types";

const COURSE_8K: CourseProfile = { distance: 8000, terrain: 0.3, firmness: 0.7, altitude: 50 };

function entrantsFor(seed: number, nTeams: number, perTeam = 7): RaceEntrant[] {
  const r = new Rng(seed);
  const out: RaceEntrant[] = [];
  for (let t = 0; t < nTeams; t++) {
    const prestige = 40 + r.int(0, 55);
    out.push({ programId: `T${t}`, athletes: generateRoster(r, prestige, perTeam), shoeTier: 1 });
  }
  return out;
}

describe("race simulation", () => {
  it("is deterministic for a given seed", () => {
    const e1 = entrantsFor(1, 5);
    const e2 = entrantsFor(1, 5);
    const a = simulateRace(COURSE_8K, "regular", e1, new Rng(99));
    const b = simulateRace(COURSE_8K, "regular", e2, new Rng(99));
    expect(a.map((r) => [r.athleteId, r.timeSec, r.place]))
      .toEqual(b.map((r) => [r.athleteId, r.timeSec, r.place]));
  });

  it("assigns unique sequential places and sorted times", () => {
    const res = simulateRace(COURSE_8K, "regular", entrantsFor(2, 6), new Rng(5));
    expect(res.map((r) => r.place)).toEqual(res.map((_, i) => i + 1));
    for (let i = 1; i < res.length; i++) expect(res[i].timeSec).toBeGreaterThanOrEqual(res[i - 1].timeSec);
  });

  it("stronger athletes beat weaker ones on average", () => {
    const strong: Athlete[] = [];
    const weak: Athlete[] = [];
    const r = new Rng(7);
    for (let i = 0; i < 7; i++) strong.push(generateAthlete(r, { stars: 5 }));
    for (let i = 0; i < 7; i++) weak.push(generateAthlete(r, { stars: 1 }));
    const res = simulateMeet(
      { id: "m", name: "Test", tier: "regular", week: 1, prestige: 50, travelCost: 0, course: COURSE_8K } as Meet,
      [{ programId: "S", athletes: strong, shoeTier: 2 }, { programId: "W", athletes: weak, shoeTier: 0 }],
      new Rng(3)
    );
    const strongTeam = res.teamScores.find((t) => t.programId === "S")!;
    const weakTeam = res.teamScores.find((t) => t.programId === "W")!;
    expect(strongTeam.score).toBeLessThan(weakTeam.score);
    expect(strongTeam.teamPlace).toBe(1);
  });

  it("finish-time spread is realistic (winner well under the field)", () => {
    const res = simulateRace(COURSE_8K, "regular", entrantsFor(9, 10), new Rng(11));
    const winner = res[0].timeSec;
    const last = res[res.length - 1].timeSec;
    // winner faster than last, and spread within a sane band (not identical, not absurd)
    expect(last).toBeGreaterThan(winner);
    expect(last / winner).toBeGreaterThan(1.03);
    expect(last / winner).toBeLessThan(1.35);
  });

  it("produces splits ending at the finish time", () => {
    const res = simulateRace(COURSE_8K, "regular", entrantsFor(4, 3), new Rng(8));
    for (const r of res) {
      expect(r.splits.length).toBeGreaterThanOrEqual(3);
      expect(Math.abs(r.splits[r.splits.length - 1] - r.timeSec)).toBeLessThan(1.0);
    }
  });
});
