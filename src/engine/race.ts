/**
 * Race simulation. Pure + deterministic given an Rng.
 *
 * performance = f(fitness readiness, course/distance fit, Race IQ pacing,
 *   big-meet temperament at championships, shoe tech) + seeded noise scaled by
 *   consistency; a tight team pack earns a small shared boost. Performance maps
 *   monotonically to a finish time; splits come from a Race-IQ pacing curve.
 */
import { Rng, clamp } from "./rng";
import { BALANCE } from "../config/balance";
import type { Athlete, CourseProfile, MeetTier, RunnerResult } from "./types";

export interface RaceEntrant {
  programId: string;
  athletes: Athlete[];   // lineup (healthy runners only)
  shoeTier?: number;     // 0–3 carbon-plate tier
  useGels?: boolean;
  useBicarb?: boolean;
  bicarbProtocol?: boolean;
}

interface PerfParts {
  perf: number;
  readiness: number;
  fit: number;
  giBlowup: boolean;
  notesSeed: { lowFit: boolean; fatigued: boolean; nervy: boolean; peaked: boolean; shod: boolean };
}

const N = (x: number) => clamp(x, 0, 99) / 99;

/** Course/distance attribute fit, 0–1. Interpolates flat-8k vs hilly-10k weights. */
function courseFit(a: Athlete, course: CourseProfile): number {
  const w10k = course.distance === 10000 ? 1 : 0;
  const terr = clamp(course.terrain, 0, 1);
  const flat = BALANCE.race.fitWeights.flat8k;
  const hilly = BALANCE.race.fitWeights.hilly10k;
  // blend by both distance and terrain
  const blend = clamp(0.5 * w10k + 0.5 * terr, 0, 1);
  const w = {
    aerobic: flat.aerobic + (hilly.aerobic - flat.aerobic) * blend,
    threshold: flat.threshold + (hilly.threshold - flat.threshold) * blend,
    speed: flat.speed + (hilly.speed - flat.speed) * blend,
    hills: flat.hills + (hilly.hills - flat.hills) * blend,
    durability: flat.durability + (hilly.durability - flat.durability) * blend,
  };
  const wsum = w.aerobic + w.threshold + w.speed + w.hills + w.durability;
  const dot =
    w.aerobic * N(a.attrs.aerobic) + w.threshold * N(a.attrs.threshold) +
    w.speed * N(a.attrs.speed) + w.hills * N(a.attrs.hills) +
    w.durability * N(a.attrs.durability);
  return dot / wsum;
}

function readiness(a: Athlete): number {
  const cw = BALANCE.fitness.ceilingWeights;
  const sw = BALANCE.fitness.sharpnessWeights;
  const ceiling = (N(a.fitness.aerobicBase) * cw.aerobicBase + N(a.fitness.lactate) * cw.lactate);
  const sharp = (N(a.fitness.vo2) * sw.vo2 + N(a.fitness.sharpness) * sw.sharpnessSys);
  const form = ceiling * 0.65 + sharp * 0.35;
  const freshness = clamp(1 - a.fitness.fatigue / BALANCE.fitness.fatigueCap, 0.4, 1);
  return form * freshness;
}

function performance(
  a: Athlete, course: CourseProfile, tier: MeetTier, entrant: RaceEntrant, rng: Rng
): PerfParts {
  const R = BALANCE.race;
  const rdy = readiness(a);
  const fit = courseFit(a, course);
  const isChamp = tier === "conference" || tier === "regional" || tier === "national";

  let perf = R.base * (R.readinessWeight * rdy + R.fitWeight * fit);
  perf += R.pacingWeight * (N(a.attrs.raceIQ) - 0.5);
  const nervy = isChamp && a.hidden.bigMeetTemperament < 45;
  if (isChamp) {
    perf += R.temperWeight * (N(a.hidden.bigMeetTemperament) - 0.5);
    // Championship under-preparation: too little season-long VO2/race-specific
    // dose ⇒ fine in the regular season, fades when the race gets honest.
    const prepRatio = clamp(a.fitness.champPrep / BALANCE.fitness.champPrepTarget, 0, 1.3);
    perf += R.champPrepWeight * (prepRatio - 1);
  }

  // Shoe tech: bigger on firm, fast courses.
  const shoeTier = entrant.shoeTier ?? 0;
  const shod = shoeTier > 0;
  perf += R.shoeBonusMax * (shoeTier / 3) * clamp(course.firmness, 0, 1);

  // Bicarb at championships: boost scaled by threshold, with GI-blowup risk.
  let giBlowup = false;
  if (entrant.useBicarb && isChamp) {
    perf += R.bicarbKick * N(a.attrs.threshold);
    const risk = R.bicarbGiRisk * (entrant.bicarbProtocol ? 0.15 : 1);
    if (rng.chance(risk)) { perf -= R.bicarbKick * 3; giBlowup = true; }
  }

  // Seeded noise, narrowed by consistency.
  const noise = rng.gauss(0, 1) * R.noiseScale * (1 - R.consistencyDamp * N(a.attrs.consistency));
  perf -= noise;

  return {
    perf,
    readiness: rdy,
    fit,
    giBlowup,
    notesSeed: {
      lowFit: fit < 0.5,
      fatigued: a.fitness.fatigue > 60,
      nervy,
      peaked: rdy > 0.8,
      shod,
    },
  };
}

function perfToTime(perf: number, course: CourseProfile): number {
  const par = BALANCE.race.par[course.distance];
  const t = par * (1 + Math.max(0, BALANCE.race.topPerf - perf) * BALANCE.race.spread);
  return Math.round(t * 10) / 10;
}

/** Split markers for a distance (metres). */
function markers(distance: number): number[] {
  return distance === 10000 ? [2000, 5000, 8000, 10000] : [2000, 5000, 8000];
}

/** Cumulative split times; low Race IQ ⇒ positive split (fade), gels reduce fade. */
function splits(a: Athlete, timeSec: number, course: CourseProfile, useGels: boolean): number[] {
  const ms = markers(course.distance);
  const total = course.distance;
  const fade = (0.5 - N(a.attrs.raceIQ)) * 0.12 * (useGels ? 1 - BALANCE.race.gelFadeReduction : 1);
  // pace multiplier rises through the race by `fade` (slower late if fade>0)
  const segPace: number[] = [];
  let prev = 0;
  for (const m of ms) {
    const mid = (prev + m) / 2 / total; // 0..1 position
    segPace.push(1 + fade * (mid - 0.5) * 2);
    prev = m;
  }
  // weight each segment by its distance, normalize so total matches timeSec
  let prevM = 0;
  const rawSeg = ms.map((m, i) => {
    const seg = (m - prevM) / total;
    prevM = m;
    return seg * segPace[i];
  });
  const rawTotal = rawSeg.reduce((s, v) => s + v, 0);
  const cum: number[] = [];
  let acc = 0;
  for (const seg of rawSeg) {
    acc += (seg / rawTotal) * timeSec;
    cum.push(Math.round(acc * 10) / 10);
  }
  return cum;
}

function buildNotes(p: PerfParts, course: CourseProfile, placeMove: number): string[] {
  const notes: string[] = [];
  if (p.giBlowup) notes.push("Bicarbonate backfired — GI distress mid-race.");
  if (p.notesSeed.fatigued) notes.push("Raced on tired legs (high fatigue).");
  if (p.notesSeed.lowFit) notes.push(`Attributes a poor fit for a ${course.distance / 1000}k${course.terrain > 0.5 ? " hilly" : ""} course.`);
  if (p.notesSeed.nervy && placeMove < -5) notes.push("Faded late — big-meet nerves.");
  if (p.notesSeed.peaked && placeMove > 3) notes.push("Peaking well — strong, controlled race.");
  if (p.notesSeed.shod && p.fit > 0.6) notes.push("Carbon-plate shoes helped on the firm course.");
  return notes.slice(0, 3);
}

/** Simulate a full field. Deterministic: entrants/athletes iterated in order. */
export function simulateRace(
  course: CourseProfile,
  tier: MeetTier,
  entrants: RaceEntrant[],
  rng: Rng
): RunnerResult[] {
  interface Prelim { r: RunnerResult; parts: PerfParts; seedPlace: number; }
  const prelim: Prelim[] = [];

  for (const e of entrants) {
    for (const a of e.athletes) {
      const parts = performance(a, course, tier, e, rng);
      const timeSec = perfToTime(parts.perf, course);
      prelim.push({
        r: {
          athleteId: a.id, programId: e.programId,
          splits: splits(a, timeSec, course, !!e.useGels),
          timeSec, place: 0, scoringPlace: 0, notes: [],
        },
        parts,
        seedPlace: 0,
      });
    }
  }

  // Pack effect: tight top-5 gap → small time reduction for that team's runners.
  const byTeam = new Map<string, Prelim[]>();
  for (const p of prelim) (byTeam.get(p.r.programId) ?? byTeam.set(p.r.programId, []).get(p.r.programId)!).push(p);
  for (const group of byTeam.values()) {
    const sorted = [...group].sort((a, b) => a.r.timeSec - b.r.timeSec);
    if (sorted.length >= 5) {
      const spread = sorted[4].r.timeSec - sorted[0].r.timeSec;
      const bonus = BALANCE.race.packMax * clamp(1 - spread / BALANCE.race.packRefSpreadSec, 0, 1);
      if (bonus > 0) for (const p of group) p.r.timeSec = Math.round(p.r.timeSec * (1 - bonus) * 10) / 10;
    }
  }

  // seed places (pre-pack) to measure place movement for notes
  [...prelim].sort((a, b) => a.parts.perf - b.parts.perf).forEach((p, i) => (p.seedPlace = prelim.length - i));

  prelim.sort((a, b) => a.r.timeSec - b.r.timeSec);
  prelim.forEach((p, i) => {
    p.r.place = i + 1;
    p.r.notes = buildNotes(p.parts, course, p.seedPlace - (i + 1));
  });
  return prelim.map((p) => p.r);
}
