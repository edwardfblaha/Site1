/**
 * League bootstrap: build the initial set of Program objects (rosters, coaches,
 * budgets) from programs.json for a given seed. Deterministic.
 */
import { Rng, clamp } from "./rng";
import { generateRoster } from "./athletes";
import { BALANCE } from "../config/balance";
import type { Program, ProgramDef, Coach, Budget, Philosophy } from "./types";
import programsData from "../data/programs.json";

export interface LeagueData {
  conferences: Record<string, string>;
  regions: string[];
  programs: ProgramDef[];
}

export const LEAGUE: LeagueData = programsData as LeagueData;

const PHILOSOPHIES: Philosophy[] = ["lydiard", "balanced", "intensity", "altitude", "norwegian"];

function defaultCoach(rng: Rng, prestige: number): Coach {
  // Stronger programs tend to have higher-rep coaches and unlocked philosophies.
  const reputation = clamp(Math.round(rng.gauss(prestige, 8)), 1, 99);
  const unlocked = PHILOSOPHIES.filter(
    (p) => reputation >= (BALANCE.philosophy[p].unlockRep as number)
  );
  const philosophy = rng.pick(unlocked.length ? unlocked : (["balanced"] as Philosophy[]));
  const tier = (base: number) => clamp(Math.round(rng.gauss(base, 1)), 0, 3) as 0 | 1 | 2 | 3;
  const base = prestige > 80 ? 2 : prestige > 60 ? 1 : 0;
  return {
    name: "Coach " + rng.int(100, 999),
    reputation,
    xp: 0,
    philosophy,
    unlocked,
    staff: { assistant: tier(base), sportsScientist: tier(base), recruitingCoordinator: tier(base) },
  };
}

function defaultBudget(prestige: number): Budget {
  const annual = BALANCE.economy.budgetByPrestige.base + prestige * BALANCE.economy.budgetByPrestige.perPrestige;
  // A plausible starting split; the player reallocates in the offseason.
  return {
    nilPool: Math.round(annual * 0.22),
    domesticRecruiting: Math.round(annual * 0.14),
    internationalRecruiting: Math.round(annual * 0.08),
    officialVisits: 5,
    media: Math.round(annual * 0.06),
    staffSpend: Math.round(annual * 0.18),
    summerCamp: Math.round(annual * 0.08),
    travel: Math.round(annual * 0.12),
    operationsPot: Math.round(annual * 0.12),
    investments: { shoeTier: prestige > 75 ? 2 : 1, shoeLifeRacesLeft: 6, recoveryTech: prestige > 80 ? 1 : 0, lab: prestige > 85, altitudeTent: false },
    consumables: { gels: 40, bicarb: 0, bicarbProtocol: false, recoveryNutrition: 20, medical: 20 },
  };
}

/** Build all Program objects for a fresh game. */
export function buildLeague(seed: number, playerProgramId: string): Program[] {
  const root = new Rng(seed);
  return LEAGUE.programs.map((def): Program => {
    // Per-program sub-stream so roster/coach gen is independent and stable.
    const r = root.fork("program:" + def.id);
    const coach = defaultCoach(r, def.prestige);
    return {
      def,
      prestige: def.prestige,
      roster: generateRoster(r, def.prestige),
      coach,
      budget: defaultBudget(def.prestige),
      seasonExpectation: 0,
      aiPhilosophy: coach.philosophy,
      isPlayer: def.id === playerProgramId,
    };
  });
}

export function findProgram(programs: Program[], id: string): Program | undefined {
  return programs.find((p) => p.def.id === id);
}
