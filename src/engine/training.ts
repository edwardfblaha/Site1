/**
 * Training & periodization. Deterministic given an Rng.
 *
 * Each week a block + volume is applied to an athlete's four fitness systems.
 * Four distinct risk channels make bad physiology bite:
 *   - injury  (ACWR spikes, volume, flat hard running; hills are safer)
 *   - burnout (sustained high intensity without recovery → "overtrained")
 *   - peaking (sharpness decays, so early intensity peaks too soon)
 *   - champPrep (season-long VO2/race-specific dose → championship readiness)
 */
import { Rng, clamp } from "./rng";
import { BALANCE } from "../config/balance";
import type { Athlete, TrainingChoice, Philosophy } from "./types";

export interface TrainCtx {
  week: number;
  nationalsWeek: number;
  medicalFactor: number;     // 0–1 (medical supplies + sports scientist)
  sportsScientist: number;   // 0–3 (reveals hidden attrs over time)
  hasLab: boolean;           // precise lactate testing available
}

const VOL_RISK: Record<string, number> = { low: 0.75, med: 1.0, high: 1.45 };

/** Advance one training week. Mutates a copy-safe athlete passed by the caller. */
export function applyTraining(a: Athlete, choice: TrainingChoice, philosophy: Philosophy, ctx: TrainCtx, rng: Rng): void {
  // Injured/overtrained athletes recover instead of training hard.
  if (a.status.kind === "injured" || a.status.kind === "overtrained" || a.status.kind === "niggle") {
    a.status.weeksLeft -= 1;
    a.fitness.fatigue = clamp(a.fitness.fatigue - BALANCE.fitness.taperShed, 0, BALANCE.fitness.fatigueCap);
    // detrain while out
    a.fitness.vo2 *= 1 - BALANCE.fitness.decay.vo2 * 2;
    a.fitness.sharpness *= 1 - BALANCE.fitness.decay.sharpness * 2;
    if (a.status.weeksLeft <= 0) a.status = { kind: "healthy" };
    return;
  }

  const blk = BALANCE.blocks[choice.block];
  const phil = BALANCE.philosophy[philosophy];
  const vol = BALANCE.volumeMult[choice.volume];
  const aMult = phil.aerobicMult as number;
  const iMult = phil.intensityMult as number;

  // Talent stratifies fitness: higher-potential athletes build faster and
  // plateau higher, so training doesn't flatten the league's talent gaps.
  const pot = a.hidden.potential;
  const cap = clamp(32 + pot * 0.68, 40, 99);          // per-system ceiling
  const talent = 0.6 + 0.4 * (pot / 99);               // gain multiplier

  // Natural decay toward 0, then apply gains (diminishing returns near the
  // athlete's talent ceiling).
  const f = a.fitness;
  const dim = (sys: number) => clamp(1 - sys / (cap + 6), 0, 1);
  const cl = (x: number) => clamp(x, 0, cap);
  f.aerobicBase = cl(f.aerobicBase * (1 - BALANCE.fitness.decay.aerobicBase) + blk.aerobicBase * vol * aMult * talent * dim(f.aerobicBase));
  f.lactate = cl(f.lactate * (1 - BALANCE.fitness.decay.lactate) + blk.lactate * vol * (ctx.hasLab ? 1.15 : 1.0) * talent * dim(f.lactate));
  f.vo2 = cl(f.vo2 * (1 - BALANCE.fitness.decay.vo2) + blk.vo2 * vol * iMult * talent * dim(f.vo2));
  f.sharpness = cl(f.sharpness * (1 - BALANCE.fitness.decay.sharpness) + blk.sharpness * vol * iMult * talent * dim(f.sharpness));

  // Load → fatigue and ACWR.
  const load = (0.4 + blk.intensity) * vol * 12;
  f.acuteLoad = f.acuteLoad * 0.7 + load * 0.3;
  f.chronicLoad = f.chronicLoad * 0.92 + load * 0.08;
  const passiveShed = choice.volume === "low" ? BALANCE.fitness.restShed : 2;
  f.fatigue = clamp(f.fatigue + blk.fatigue * vol - passiveShed, 0, BALANCE.fitness.fatigueCap);

  // Season-long championship intensity dose.
  f.champPrep = clamp(f.champPrep + blk.champPrep * vol, 0, 120);

  // Peak-week tracker: weight current week by how peak-biased this block is.
  if (blk.sharpness * vol > 0) {
    f.peakWeek = f.peakWeek === 0 ? ctx.week : (f.peakWeek * (1 - 0.3 * blk.peakBias) + ctx.week * 0.3 * blk.peakBias);
  }

  // ---- Injury ----
  const acwr = f.chronicLoad > 0 ? f.acuteLoad / f.chronicLoad : 1;
  const terrain = choice.hillEmphasis ? BALANCE.injury.terrainMult.uphill : BALANCE.injury.terrainMult.flat;
  let pInj = BALANCE.injury.base
    * VOL_RISK[choice.volume]
    * (0.5 + blk.intensity)
    * (a.hidden.injuryProneness / 55)
    * (1 - BALANCE.injury.durabilityRelief * (a.attrs.durability / 99))
    * (1 + f.fatigue / BALANCE.fitness.fatigueCap)
    * terrain
    * (phil.injuryMult as number)
    * (1 - BALANCE.injury.medicalRelief * ctx.medicalFactor);
  if (acwr > BALANCE.fitness.acwrWindow.high) pInj *= BALANCE.injury.acwrSpikePenalty;

  if (rng.chance(pInj)) {
    const sevRoll = rng.next();
    const severity = sevRoll > 0.85 ? "major" : sevRoll > 0.5 ? "moderate" : "minor";
    const [lo, hi] = BALANCE.injury.weeksOut[severity];
    a.status = severity === "minor"
      ? { kind: "niggle", weeksLeft: rng.int(lo, hi) }
      : { kind: "injured", weeksLeft: rng.int(lo, hi), severity };
    a.attrs.morale = clamp(a.attrs.morale - 6, 1, 99);
    return;
  }

  // ---- Burnout / overtraining ----
  if (blk.intensity > 0.7 && f.fatigue > 75 && acwr > BALANCE.fitness.acwrWindow.high) {
    const pBurn = BALANCE.injury.burnoutBase * (f.fatigue / BALANCE.fitness.fatigueCap) * (2 - (phil.injuryMult as number));
    if (rng.chance(pBurn)) {
      a.status = { kind: "overtrained", weeksLeft: rng.int(2, 4) };
      a.attrs.morale = clamp(a.attrs.morale - 10, 1, 99);
      return;
    }
  }

  // Gradual reveal of hidden attributes via sports science + racing.
  if (ctx.sportsScientist > 0 && rng.chance(0.08 * ctx.sportsScientist)) {
    const keys = ["potential", "injuryProneness", "bigMeetTemperament"] as const;
    a.revealed[rng.pick(keys)] = true;
  }
}

/** Offseason year-over-year development + aging. */
export function developAthlete(a: Athlete, philosophyFit: number, rng: Rng): void {
  const age = BALANCE.development.ageCurve[a.classYear] ?? 0.5;
  const gap = Math.max(0, a.hidden.potential - overall(a));
  const health = a.status.kind === "healthy" ? 1 : BALANCE.development.healthPenalty;
  const morale = 1 + (a.attrs.morale - 60) / 100 * BALANCE.development.moraleScale;
  const growth = BALANCE.development.growth * age * (gap / 99) * philosophyFit * health * morale;

  for (const k of ["aerobic", "threshold", "speed", "hills", "durability", "raceIQ"] as const) {
    a.attrs[k] = clamp(Math.round(a.attrs[k] + growth * rng.float(0.5, 1.5)), 1, 99);
  }
  // fitness ceilings grow with attributes
  a.fitness.aerobicBase = clamp(a.fitness.aerobicBase + growth * 0.8, 0, 99);
  a.fitness.lactate = clamp(a.fitness.lactate + growth * 0.7, 0, 99);

  // age up
  const nextYear: Record<string, Athlete["classYear"]> = { FR: "SO", SO: "JR", JR: "SR", SR: "5TH", "5TH": "GRAD", GRAD: "GRAD" };
  a.classYear = nextYear[a.classYear];
  a.eligibilityLeft = Math.max(0, a.eligibilityLeft - 1);
}

export function overall(a: Athlete): number {
  return Math.round(
    (a.attrs.aerobic + a.attrs.threshold + a.attrs.speed + a.attrs.hills) / 4
  );
}
