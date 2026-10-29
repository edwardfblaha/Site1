import { describe, it, expect } from "vitest";
import { buildLeague, LEAGUE, findProgram } from "../src/engine/league";

describe("league bootstrap", () => {
  it("programs.json has ~150–200 fictional teams across 9 regions", () => {
    expect(LEAGUE.programs.length).toBeGreaterThanOrEqual(150);
    expect(LEAGUE.programs.length).toBeLessThanOrEqual(200);
    expect(LEAGUE.regions).toHaveLength(9);
    expect(LEAGUE.programs.filter((p) => p.isTop50)).toHaveLength(50);
  });

  it("every program has a valid region and conference", () => {
    const confIds = new Set(Object.keys(LEAGUE.conferences));
    const regionIds = new Set(LEAGUE.regions);
    for (const p of LEAGUE.programs) {
      expect(regionIds.has(p.region)).toBe(true);
      expect(confIds.has(p.conference)).toBe(true);
      expect(p.colorPrimary).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("builds deterministically from a seed", () => {
    const a = buildLeague(2026, "oregon");
    const b = buildLeague(2026, "oregon");
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it("marks exactly one player program and gives everyone a roster", () => {
    const programs = buildLeague(2026, "oregon");
    expect(programs.filter((p) => p.isPlayer)).toHaveLength(1);
    expect(findProgram(programs, "oregon")?.isPlayer).toBe(true);
    for (const p of programs) {
      expect(p.roster.length).toBeGreaterThanOrEqual(12);
      expect(p.coach.philosophy).toBeTruthy();
      expect(p.budget.operationsPot).toBeGreaterThan(0);
    }
  });

  it("no real NCAA brand strings in team names", () => {
    const banned = /\bNCAA\b|Wildcats|Buckeyes|Ducks|Gators|Tar Heels/i;
    for (const p of LEAGUE.programs) expect(p.name).not.toMatch(banned);
  });
});
