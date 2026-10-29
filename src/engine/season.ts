/**
 * Season orchestration. Builds a calendar, advances weekly training for the
 * whole league, runs regular-season meets, then the championship path
 * (conference → regional → Kolas at-large → nationals). Deterministic.
 *
 * Reusable building blocks (trainLeagueWeek, runMeet) are also used by the
 * interactive UI; `simulateSeason` auto-plays an entire season headlessly.
 */
import { Rng, clamp } from "./rng";
import { applyTraining, developAthlete, overall, type TrainCtx } from "./training";
import { aiTrainingChoice, aiLineup, competenceOf } from "./ai";
import { simulateMeet, type RaceEntrant } from "./meet";
import { selectQualifiers } from "./championships";
import type { Program, Meet, RaceResult, CourseProfile, TrainingChoice, RegionId, Athlete } from "./types";

export const NATIONALS_WEEK = 12;

const COURSES: CourseProfile[] = [
  { distance: 8000, terrain: 0.3, firmness: 0.7, altitude: 150 },
  { distance: 8000, terrain: 0.55, firmness: 0.5, altitude: 400 },
  { distance: 8000, terrain: 0.2, firmness: 0.85, altitude: 60 },
];

export interface SeasonResult {
  year: number;
  champion: string;
  nationalsOrder: string[];       // team ids by finish
  nationalsField: string[];
  injuriesDuringSeason: number;
  results: RaceResult[];
  playerNationalFinish: number | null;
}

function medicalFactor(p: Program): number {
  return clamp(p.budget.consumables.medical / 60 + p.coach.staff.sportsScientist * 0.12, 0, 1);
}
function trainCtx(p: Program, week: number): TrainCtx {
  return {
    week, nationalsWeek: NATIONALS_WEEK,
    medicalFactor: medicalFactor(p),
    sportsScientist: p.coach.staff.sportsScientist,
    hasLab: p.budget.investments.lab,
  };
}

/** Apply one training week to the whole league. Player choice overrides AI. */
export function trainLeagueWeek(
  programs: Program[], week: number, rng: Rng, playerChoice?: TrainingChoice
): number {
  let injuriesBefore = countInjured(programs);
  for (const p of programs) {
    const comp = competenceOf(p);
    const pr = rng.fork(`train:${p.def.id}:${week}`);
    for (const a of p.roster) {
      const choice = p.isPlayer && playerChoice
        ? playerChoice
        : aiTrainingChoice(p.aiPhilosophy, week, NATIONALS_WEEK, comp, pr);
      applyTraining(a, choice, p.isPlayer ? p.coach.philosophy : p.aiPhilosophy, trainCtx(p, week), pr);
    }
  }
  return countInjured(programs) - injuriesBefore;
}

function countInjured(programs: Program[]): number {
  let n = 0;
  for (const p of programs) for (const a of p.roster) if (a.status.kind === "injured" || a.status.kind === "overtrained") n++;
  return n;
}

function entrantFor(p: Program, override?: Athlete[]): RaceEntrant {
  return {
    programId: p.def.id,
    athletes: override ?? aiLineup(p, 7),
    shoeTier: p.budget.investments.shoeTier,
    useGels: p.budget.consumables.gels > 0,
    useBicarb: false,
  };
}

/** Run a meet among a set of programs. `overrides` supplies chosen lineups. */
export function runMeet(meet: Meet, programs: Program[], rng: Rng, overrides?: Map<string, Athlete[]>): RaceResult {
  const entrants = programs
    .map((p) => entrantFor(p, overrides?.get(p.def.id)))
    .filter((e) => e.athletes.length >= 5);
  return simulateMeet(meet, entrants, rng);
}

export interface WeekMeetOutcome {
  results: RaceResult[];
  playerResult: RaceResult | null;
  regionalResults?: Record<string, RaceResult>;
  qualification?: ReturnType<typeof selectQualifiers>;
}

/**
 * Run the meets scheduled for a given week (used by the interactive UI).
 * `priorResults` lets week 11 compute at-large from the full season.
 */
export function raceWeekMeets(
  programs: Program[], week: number, rng: Rng,
  opts: { playerId?: string; playerLineup?: Athlete[]; priorResults?: RaceResult[] } = {}
): WeekMeetOutcome {
  const ov = new Map<string, Athlete[]>();
  if (opts.playerId && opts.playerLineup) ov.set(opts.playerId, opts.playerLineup);
  const results: RaceResult[] = [];
  let playerResult: RaceResult | null = null;
  const playerRegion = programs.find((p) => p.def.id === opts.playerId)?.def.region;
  const playerConf = programs.find((p) => p.def.id === opts.playerId)?.def.conference;

  if (week === 4 || week === 6 || week === 8) {
    const course = COURSES[(week / 2) % COURSES.length | 0];
    for (const region of regionsOf(programs)) {
      const field = programs.filter((p) => p.def.region === region);
      const meet: Meet = { id: `inv-${region}-w${week}`, name: `${cap(region)} Invitational`, tier: "regular", week, prestige: 60, travelCost: 10, course };
      const res = runMeet(meet, field, rng.fork(`inv:${region}:${week}`), ov);
      results.push(res);
      if (region === playerRegion) playerResult = res;
    }
  } else if (week === 10) {
    for (const conf of conferencesOf(programs)) {
      const field = programs.filter((p) => p.def.conference === conf);
      const meet: Meet = { id: `conf-${conf}`, name: `${conf} Championship`, tier: "conference", week: 10, prestige: 75, travelCost: 15, course: COURSES[0] };
      const res = runMeet(meet, field, rng.fork(`conf:${conf}`), ov);
      results.push(res);
      if (conf === playerConf) playerResult = res;
    }
  } else if (week === 11) {
    const regionalResults: Record<string, RaceResult> = {};
    const regionalCourse: CourseProfile = { distance: 10000, terrain: 0.5, firmness: 0.6, altitude: 300 };
    for (const region of regionsOf(programs)) {
      const field = programs.filter((p) => p.def.region === region);
      const meet: Meet = { id: `regional-${region}`, name: `${cap(region)} Regional`, tier: "regional", week: 11, prestige: 85, travelCost: 20, course: regionalCourse };
      const res = runMeet(meet, field, rng.fork(`regional:${region}`), ov);
      regionalResults[region] = res;
      results.push(res);
      if (region === playerRegion) playerResult = res;
    }
    const qualification = selectQualifiers(programs, regionalResults, [...(opts.priorResults ?? []), ...results]);
    return { results, playerResult, regionalResults, qualification };
  } else if (week === 12) {
    // caller supplies qualification field via priorResults selection; handled in game controller
  }
  return { results, playerResult };
}

/** Run the national championship for a given 31-team field. */
export function runNationals(programs: Program[], field: string[], rng: Rng, overrides?: Map<string, Athlete[]>): RaceResult {
  const fieldPrograms = field.map((id) => programs.find((p) => p.def.id === id)!).filter(Boolean);
  const natMeet: Meet = {
    id: "nationals", name: "National Championship", tier: "national", week: 12, prestige: 100, travelCost: 40,
    course: { distance: 10000, terrain: 0.45, firmness: 0.65, altitude: 260 },
  };
  return runMeet(natMeet, fieldPrograms, rng.fork("nationals"), overrides);
}

/** Auto-play a full season for the whole league. */
export function simulateSeason(programs: Program[], seed: number, year: number): SeasonResult {
  const rng = new Rng(seed).fork(`season:${year}`);
  const results: RaceResult[] = [];
  let injuries = 0;

  // Regular season: train each week; race on weeks 4,6,8 at regional invites.
  for (let week = 1; week <= 9; week++) {
    injuries += trainLeagueWeek(programs, week, rng);
    if (week === 4 || week === 6 || week === 8) {
      // group by region into invitationals so everyone races a comparable field
      const course = COURSES[(week / 2) % COURSES.length | 0];
      for (const region of regionsOf(programs)) {
        const field = programs.filter((p) => p.def.region === region);
        const meet: Meet = {
          id: `inv-${region}-w${week}`, name: `${cap(region)} Invitational`, tier: "regular",
          week, prestige: 60, travelCost: 10, course,
        };
        results.push(runMeet(meet, field, rng));
      }
    }
  }

  // Week 10: conference championships.
  injuries += trainLeagueWeek(programs, 10, rng);
  for (const conf of conferencesOf(programs)) {
    const field = programs.filter((p) => p.def.conference === conf);
    const meet: Meet = {
      id: `conf-${conf}`, name: `${conf} Championship`, tier: "conference", week: 10,
      prestige: 75, travelCost: 15, course: COURSES[0],
    };
    results.push(runMeet(meet, field, rng));
  }

  // Week 11: regional championships (10k). Top 2 auto-qualify.
  injuries += trainLeagueWeek(programs, 11, rng);
  const regionalResults: Record<string, RaceResult> = {};
  const regionalCourse: CourseProfile = { distance: 10000, terrain: 0.5, firmness: 0.6, altitude: 300 };
  for (const region of regionsOf(programs)) {
    const field = programs.filter((p) => p.def.region === region);
    const meet: Meet = {
      id: `regional-${region}`, name: `${cap(region)} Regional`, tier: "regional", week: 11,
      prestige: 85, travelCost: 20, course: regionalCourse,
    };
    const res = runMeet(meet, field, rng);
    regionalResults[region] = res;
    results.push(res);
  }

  // Kolas at-large → 31-team nationals (10k).
  const qual = selectQualifiers(programs, regionalResults, results);
  injuries += trainLeagueWeek(programs, 12, rng);
  const fieldPrograms = qual.nationalsField
    .map((id) => programs.find((p) => p.def.id === id)!)
    .filter(Boolean);
  const natMeet: Meet = {
    id: "nationals", name: "National Championship", tier: "national", week: 12,
    prestige: 100, travelCost: 40,
    course: { distance: 10000, terrain: 0.45, firmness: 0.65, altitude: 260 },
  };
  const natResult = runMeet(natMeet, fieldPrograms, rng);
  results.push(natResult);

  const order = [...natResult.teamScores].sort((a, b) => a.teamPlace - b.teamPlace).map((t) => t.programId);
  const player = programs.find((p) => p.isPlayer);
  const playerFinish = player ? (order.indexOf(player.def.id) >= 0 ? order.indexOf(player.def.id) + 1 : null) : null;

  return {
    year,
    champion: order[0] ?? "",
    nationalsOrder: order,
    nationalsField: qual.nationalsField,
    injuriesDuringSeason: injuries,
    results,
    playerNationalFinish: playerFinish,
  };
}

/** Offseason: graduations leave, everyone else develops + ages. */
export function runOffseason(programs: Program[], rng: Rng): void {
  for (const p of programs) {
    const philFit = philosophyFit(p);
    // graduate (no eligibility left) out
    p.roster = p.roster.filter((a) => a.eligibilityLeft > 0 && a.classYear !== "GRAD");
    for (const a of p.roster) developAthlete(a, philFit, rng.fork(`dev:${a.id}`));
  }
}

function philosophyFit(p: Program): number {
  // balanced programs develop most reliably; extremes trade off (tunable)
  const base = p.coach.philosophy === "balanced" ? 1.05 : 1.0;
  return clamp(base * (0.85 + p.coach.reputation / 300), 0.8, 1.25);
}

export function teamStrength(p: Program): number {
  const top7 = [...p.roster].sort((a, b) => overall(b) - overall(a)).slice(0, 7);
  return top7.reduce((s, a) => s + overall(a), 0) / Math.max(1, top7.length);
}

// ---- helpers ----
function regionsOf(programs: Program[]): RegionId[] {
  return [...new Set(programs.map((p) => p.def.region))] as RegionId[];
}
function conferencesOf(programs: Program[]): string[] {
  return [...new Set(programs.map((p) => p.def.conference))];
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
