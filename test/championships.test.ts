import { describe, it, expect } from "vitest";
import { computeHeadToHead, selectQualifiers } from "../src/engine/championships";
import type { RaceResult, TeamScore } from "../src/engine/types";

function result(id: string, order: string[]): RaceResult {
  const teamScores: TeamScore[] = order.map((pid, i) => ({
    programId: pid, score: (i + 1) * 15, scorers: [], displacers: [],
    sixthRunnerPlace: 0, teamPlace: i + 1,
  }));
  return { meetId: id, week: 1, runners: [], teamScores };
}

describe("head-to-head", () => {
  it("counts a win for the team that finished ahead", () => {
    const h = computeHeadToHead([result("m1", ["A", "B", "C"])]);
    expect(h.wins.get("A")?.get("B")).toBe(1);
    expect(h.wins.get("A")?.get("C")).toBe(1);
    expect(h.wins.get("B")?.get("C")).toBe(1);
    expect(h.wins.get("C")?.get("A")).toBeUndefined();
  });
});

describe("Kolas qualification", () => {
  // 9 regions × 6 teams
  const regions = ["r1","r2","r3","r4","r5","r6","r7","r8","r9"];
  const regionalResults: Record<string, RaceResult> = {};
  const season: RaceResult[] = [];
  regions.forEach((rg) => {
    const teams = Array.from({ length: 6 }, (_, k) => `${rg}t${k}`);
    const res = result(`reg-${rg}`, teams);
    regionalResults[rg] = res;
    season.push(res);
  });
  // add season meets so non-auto teams accrue head-to-head wins over key teams:
  // make each region's #3 team beat lots of other regions' top-2 teams.
  regions.forEach((rg) => {
    const keyBeaters = regions.map((o) => `${o}t0`); // all regions' winners
    season.push(result(`cross-${rg}`, [`${rg}t2`, ...keyBeaters]));
  });

  it("selects 2 auto per region, 13 at-large, 31-team field", () => {
    const q = selectQualifiers([], regionalResults, season);
    expect(q.autoQ).toHaveLength(18);
    expect(q.atLarge).toHaveLength(13);
    expect(q.nationalsField).toHaveLength(31);
    // auto-qualifiers are each region's top 2
    for (const rg of regions) {
      expect(q.autoQ).toContain(`${rg}t0`);
      expect(q.autoQ).toContain(`${rg}t1`);
    }
    // no duplicates
    expect(new Set(q.nationalsField).size).toBe(31);
  });

  it("at-large favors teams with more wins over key teams", () => {
    const q = selectQualifiers([], regionalResults, season);
    // the #3 teams we boosted should feature among at-large picks
    const boosted = regions.map((rg) => `${rg}t2`);
    const picked = boosted.filter((t) => q.atLarge.includes(t)).length;
    expect(picked).toBeGreaterThan(0);
  });
});
