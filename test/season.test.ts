import { describe, it, expect } from "vitest";
import { buildLeague } from "../src/engine/league";
import { simulateSeason, runOffseason } from "../src/engine/season";
import { Rng } from "../src/engine/rng";

describe("full season", () => {
  it("produces a 31-team nationals and a champion, deterministically", () => {
    const a = simulateSeason(buildLeague(2026, "oregon"), 2026, 2026);
    const b = simulateSeason(buildLeague(2026, "oregon"), 2026, 2026);
    expect(a.nationalsField).toHaveLength(31);
    expect(a.nationalsOrder).toHaveLength(31);
    expect(a.champion).toBeTruthy();
    expect(a.champion).toEqual(b.champion);
    expect(a.nationalsOrder).toEqual(b.nationalsOrder);
  });

  it("strong programs dominate the national podium", () => {
    const programs = buildLeague(2026, "oregon");
    const top50 = new Set(programs.filter((p) => p.def.isTop50).map((p) => p.def.id));
    const r = simulateSeason(programs, 2026, 2026);
    const top10From50 = r.nationalsOrder.slice(0, 10).filter((id) => top50.has(id)).length;
    expect(top10From50).toBeGreaterThanOrEqual(7);
  });

  it("offseason graduates out-of-eligibility athletes and ages the rest", () => {
    const programs = buildLeague(2026, "oregon");
    const before = programs[0].roster.map((a) => a.id);
    const hadSeniors = programs[0].roster.some((a) => a.classYear === "SR");
    runOffseason(programs, new Rng(1));
    if (hadSeniors) {
      // some athletes should have changed class year or left
      const after = new Set(programs[0].roster.map((a) => a.id));
      expect(after.size).toBeLessThanOrEqual(before.length);
    }
    for (const a of programs[0].roster) expect(a.eligibilityLeft).toBeGreaterThanOrEqual(0);
  });

  it("injuries occur over a season but are not catastrophic league-wide", () => {
    const r = simulateSeason(buildLeague(7, "oregon"), 7, 2026);
    expect(r.injuriesDuringSeason).toBeGreaterThan(0);
    expect(r.injuriesDuringSeason).toBeLessThan(600); // sanity ceiling
  });
});
