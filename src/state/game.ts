/**
 * Interactive game controller. Operates on a plain, serializable GameSave so
 * it can be stored in localStorage / exported as JSON. All randomness is
 * derived by forking the seed with stable (year/week/meet) keys, so saves are
 * fully reproducible without tracking an RNG cursor.
 */
import {
  Rng, buildLeague, generateRecruitPool, setExpectations, updateCareer, jobOffers,
  runFullOffseason, graduateAndDevelop, runPortal, preseasonReset, trainLeagueWeek, raceWeekMeets, runNationals, aiLineup,
  computeHeadToHead, teamStrength, overall, maybeEvent, baseInterest, signingProbability,
} from "../engine";
import type {
  Program, Recruit, RaceResult, TrainingChoice, Athlete, SeasonPhase,
} from "../engine";

export const RACE_WEEKS = [4, 6, 8, 10, 11, 12];
export const FINAL_WEEK = 12;
export const isRaceWeek = (w: number) => RACE_WEEKS.includes(w);

export interface FitnessPoint { week: number; fitness: number; fresh: number }
export interface SeasonSummary {
  year: number; championId: string; championName: string;
  playerFinish: number | null; expectation: number;
  repDelta: number; prestigeDelta: number; metExpectation: boolean;
  offers: { programId: string; programName: string; prestige: number }[];
}

export interface GameSave {
  version: number;
  seed: number;
  playerId: string;
  year: number;
  week: number;
  phase: SeasonPhase;         // "regular" | "offseason"
  trainedThisWeek: boolean;
  programs: Program[];
  pool: Recruit[];
  seasonResults: RaceResult[];
  qualField: string[] | null;
  careerHistory: (number | null)[];
  fitnessHistory: FitnessPoint[];
  lastSummary: SeasonSummary | null;
  offseasonEventPending: boolean;
  signedThisCycle: number;
  log: string[];
}

const START_YEAR = 2026;

function rngFor(save: GameSave, key: string): Rng {
  return new Rng(save.seed).fork(`y${save.year}:${key}`);
}
export function player(save: GameSave): Program {
  return save.programs.find((p) => p.def.id === save.playerId)!;
}

export function newGame(seed: number, playerId: string): GameSave {
  const programs = buildLeague(seed, playerId);
  setExpectations(programs);
  return {
    version: 1, seed, playerId, year: START_YEAR, week: 1, phase: "regular",
    trainedThisWeek: false, programs,
    pool: generateRecruitPool(new Rng(seed), START_YEAR),
    seasonResults: [], qualField: null, careerHistory: [], fitnessHistory: [],
    lastSummary: null, offseasonEventPending: false, signedThisCycle: 0,
    log: [`Took over ${programs.find((p) => p.def.id === playerId)!.def.name}.`],
  };
}

function recordFitness(save: GameSave) {
  const p = player(save);
  const healthy = p.roster.filter((a) => a.status.kind === "healthy");
  if (!healthy.length) return;
  const fit = healthy.reduce((s, a) => s + (a.fitness.aerobicBase * 0.4 + a.fitness.lactate * 0.3 + a.fitness.vo2 * 0.2 + a.fitness.sharpness * 0.1), 0) / healthy.length;
  const fresh = healthy.reduce((s, a) => s + (1 - a.fitness.fatigue / 99), 0) / healthy.length * 100;
  save.fitnessHistory.push({ week: save.week, fitness: Math.round(fit), fresh: Math.round(fresh) });
}

/** Apply this week's training to the whole league (player uses `choice`). */
export function trainWeek(save: GameSave, choice: TrainingChoice): void {
  if (save.phase !== "regular" || save.trainedThisWeek) return;
  trainLeagueWeek(save.programs, save.week, rngFor(save, `train:w${save.week}`), choice);
  recordFitness(save);
  save.trainedThisWeek = true;
  if (!isRaceWeek(save.week)) advanceWeek(save);
}

function advanceWeek(save: GameSave): void {
  save.week += 1;
  save.trainedThisWeek = false;
  if (save.week > FINAL_WEEK) enterOffseason(save);
}

/** Run the current race week with the player's chosen lineup (athlete ids). */
export function raceWeek(save: GameSave, lineupIds: string[]): RaceResult | null {
  if (save.phase !== "regular" || !isRaceWeek(save.week) || !save.trainedThisWeek) return null;
  const p = player(save);
  const lineup = lineupIds
    .map((id) => p.roster.find((a) => a.id === id))
    .filter((a): a is Athlete => !!a && a.status.kind === "healthy");
  const rng = rngFor(save, `race:w${save.week}`);

  if (save.week === 12) {
    if (!save.qualField) { advanceWeek(save); return null; }
    const ov = new Map<string, Athlete[]>([[save.playerId, lineup]]);
    const res = runNationals(save.programs, save.qualField, rng, ov);
    save.seasonResults.push(res);
    advanceWeek(save);
    return res;
  }

  const outcome = raceWeekMeets(save.programs, save.week, rng, {
    playerId: save.playerId, playerLineup: lineup, priorResults: save.seasonResults,
  });
  save.seasonResults.push(...outcome.results);
  if (outcome.qualification) save.qualField = outcome.qualification.nationalsField;
  advanceWeek(save);
  return outcome.playerResult;
}

/** Can the player race nationals (did they qualify)? */
export function playerQualified(save: GameSave): boolean {
  return !!save.qualField && save.qualField.includes(save.playerId);
}

// ---------- rankings ----------
export interface RankRow { programId: string; name: string; color: string; power: number; strength: number }
export function nationalRankings(save: GameSave): RankRow[] {
  const h2h = computeHeadToHead(save.seasonResults);
  const rows = save.programs.map((p) => {
    const row = h2h.wins.get(p.def.id);
    let w = 0, g = 0;
    if (row) for (const n of row.values()) { w += n; g += n; }
    const opp = [...h2h.wins.values()].reduce((s, m) => s + (m.get(p.def.id) ?? 0), 0);
    const winPct = w + opp > 0 ? w / (w + opp) : 0.5;
    const strength = teamStrength(p);
    return { programId: p.def.id, name: p.def.name, color: p.def.colorPrimary, strength, power: strength * 0.75 + winPct * 25 };
  });
  rows.sort((a, b) => b.power - a.power);
  return rows;
}

// ---------- offseason ----------
function finishMap(result: RaceResult | undefined): Map<string, number> {
  const m = new Map<string, number>();
  if (!result) return m;
  [...result.teamScores].sort((a, b) => a.teamPlace - b.teamPlace).forEach((t, i) => m.set(t.programId, i + 1));
  return m;
}

export function enterOffseason(save: GameSave): void {
  save.phase = "offseason";
  const nats = save.seasonResults.find((r) => r.meetId === "nationals");
  const fm = finishMap(nats);
  const order = nats ? [...nats.teamScores].sort((a, b) => a.teamPlace - b.teamPlace) : [];
  const championId = order[0]?.programId ?? "";

  // update every program's career from its national finish
  let playerUpdate = { reputationDelta: 0, prestigeDelta: 0, metExpectation: false };
  const p = player(save);
  const expectation = p.seasonExpectation;
  for (const prog of save.programs) {
    const finish = fm.get(prog.def.id) ?? null;
    const u = updateCareer(prog, finish);
    if (prog.isPlayer) playerUpdate = u;
  }
  const playerFinish = fm.get(save.playerId) ?? null;
  save.careerHistory.push(playerFinish);

  const offers = jobOffers(save.programs, p, { playerNationalFinish: playerFinish }, rngFor(save, "offers"));
  save.lastSummary = {
    year: save.year, championId, championName: save.programs.find((x) => x.def.id === championId)?.def.name ?? "—",
    playerFinish, expectation, repDelta: playerUpdate.reputationDelta,
    prestigeDelta: playerUpdate.prestigeDelta, metExpectation: playerUpdate.metExpectation, offers,
  };
  save.offseasonEventPending = true;
  save.signedThisCycle = 0;
  save.log.unshift(`${save.year}: finished ${playerFinish ? "#" + playerFinish : "unqualified"} at nationals.`);
}

/** The pending narrative event (recomputed deterministically; not serialized). */
export function currentEvent(save: GameSave) {
  if (!save.offseasonEventPending) return null;
  return maybeEvent(player(save), rngFor(save, "event"));
}
export function resolveEvent(save: GameSave, choiceIndex: number): void {
  const ev = currentEvent(save);
  if (!ev) { save.offseasonEventPending = false; return; }
  const p = player(save);
  const athlete = ev.athleteId ? p.roster.find((a) => a.id === ev.athleteId) : undefined;
  ev.choices[choiceIndex]?.apply(p, athlete, rngFor(save, "event:apply"));
  save.offseasonEventPending = false;
}

/** Recruits the player can pursue, best first, with interest + sign odds. */
export interface RecruitRow { recruit: Recruit; interest: number; odds: number }
export function recruitBoard(save: GameSave, limit = 20): RecruitRow[] {
  const p = player(save);
  return save.pool
    .filter((r) => !r.signedBy)
    .map((r) => {
      const interest = baseInterest(r, p);
      return { recruit: r, interest, odds: signingProbability(r, p, interest) };
    })
    .sort((a, b) => b.recruit.athlete.starRating - a.recruit.athlete.starRating || b.odds - a.odds)
    .slice(0, limit);
}

export function playerSign(save: GameSave, recruitId: string): { signed: boolean; reason: string } {
  const p = player(save);
  if (p.roster.length >= 18) return { signed: false, reason: "Roster full (18)." };
  if (save.signedThisCycle >= 6) return { signed: false, reason: "Signed the max this cycle (6)." };
  const rec = save.pool.find((r) => r.id === recruitId);
  if (!rec || rec.signedBy) return { signed: false, reason: "No longer available." };
  const interest = baseInterest(rec, p);
  const odds = signingProbability(rec, p, interest);
  const r = rngFor(save, `sign:${recruitId}`);
  if (r.chance(odds)) {
    rec.signedBy = p.def.id;
    rec.athlete.classYear = "FR";
    p.roster.push(rec.athlete);
    save.signedThisCycle++;
    return { signed: true, reason: `Signed ${rec.athlete.firstName} ${rec.athlete.lastName}!` };
  }
  rec.competingOffers++;
  return { signed: false, reason: "He chose another program." };
}

/** Finish offseason: AI handles the rest of the league, then a new season begins. */
export function startNextSeason(save: GameSave): void {
  const rng = rngFor(save, "offseason");
  // other programs recruit + whole league develops/ages/portal
  runFullOffseason(save.programs.filter((p) => !p.isPlayer), save.pool, rng.fork("ai-offseason"));
  // player program: develop + graduate too (already recruited interactively)
  runPortal(save.programs.filter((p) => p.isPlayer), rng.fork("player-portal"));
  graduateAndDevelop(save.programs.filter((p) => p.isPlayer), rng.fork("player-dev"));
  setExpectations(save.programs);
  preseasonReset(save.programs);

  save.year += 1;
  save.week = 1;
  save.phase = "regular";
  save.trainedThisWeek = false;
  save.seasonResults = [];
  save.qualField = null;
  save.fitnessHistory = [];
  save.offseasonEventPending = false;
  save.pool = generateRecruitPool(new Rng(save.seed), save.year);
}

export function topRunners(p: Program, n = 7): Athlete[] {
  return [...p.roster].sort((a, b) => overall(b) - overall(a)).slice(0, n);
}
export { aiLineup };
