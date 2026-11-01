/**
 * Training preview — a PURE, deterministic projection of what a week of a
 * given training choice will do to the player's roster, with NO RNG side
 * effects. It mirrors the deterministic half of `applyTraining` (fitness
 * gains, fatigue, ACWR, champ-prep) and surfaces the *expected* injury /
 * burnout probabilities that the real week rolls against.
 *
 * This is what lets the UI show the tradeoffs of a decision before the
 * coach commits to it (fitness up vs. fatigue + injury risk), which is the
 * backbone of a guided, OOTP-style training screen.
 */
import { clamp } from "./rng";
import { BALANCE } from "../config/balance";
import type { Athlete, Program, TrainingChoice } from "./types";

const VOL_RISK: Record<string, number> = { low: 0.75, med: 1.0, high: 1.45 };

type Systems = { aerobicBase: number; lactate: number; vo2: number; sharpness: number };

export interface AthleteTrainingProjection {
  athleteId: string;
  name: string;
  classYear: string;
  injuryRisk: number;     // 0–1, probability this athlete goes down this week
  overtrainRisk: number;  // 0–1, probability of burnout this week
  fatigueBefore: number;  // 0–99
  fatigueAfter: number;   // 0–99
  acwr: number;           // acute:chronic load ratio after this week
}

export interface TrainingPreview {
  healthyCount: number;
  before: Systems;
  after: Systems;
  deltas: Systems;
  fatigueBefore: number;   // team avg 0–99
  fatigueAfter: number;    // team avg 0–99
  freshnessAfter: number;  // 100 − fatigueAfter
  avgInjuryRisk: number;   // team mean 0–1
  teamInjuryRisk: number;  // P(≥1 athlete goes down this week) 0–1
  champPrepBefore: number; // 0–1 of the season-long target
  champPrepAfter: number;  // 0–1 of the season-long target
  atRisk: AthleteTrainingProjection[]; // every healthy athlete, highest risk first
}

/** Project one healthy athlete's week deterministically (no mutation, no RNG). */
function projectAthlete(a: Athlete, choice: TrainingChoice, p: Program): AthleteTrainingProjection & { sys: Systems; champPrep: number } {
  const blk = BALANCE.blocks[choice.block];
  const phil = BALANCE.philosophy[p.coach.philosophy];
  const vol = BALANCE.volumeMult[choice.volume];
  const aMult = phil.aerobicMult as number;
  const iMult = phil.intensityMult as number;
  const hasLab = p.budget.investments.lab;
  const medicalFactor = clamp(p.budget.consumables.medical / 60 + p.coach.staff.sportsScientist * 0.12, 0, 1);

  const pot = a.hidden.potential;
  const cap = clamp(32 + pot * 0.68, 40, 99);
  const talent = 0.6 + 0.4 * (pot / 99);

  const f = a.fitness;
  const dim = (sys: number) => clamp(1 - sys / (cap + 6), 0, 1);
  const cl = (x: number) => clamp(x, 0, cap);
  const sys: Systems = {
    aerobicBase: cl(f.aerobicBase * (1 - BALANCE.fitness.decay.aerobicBase) + blk.aerobicBase * vol * aMult * talent * dim(f.aerobicBase)),
    lactate: cl(f.lactate * (1 - BALANCE.fitness.decay.lactate) + blk.lactate * vol * (hasLab ? 1.15 : 1.0) * talent * dim(f.lactate)),
    vo2: cl(f.vo2 * (1 - BALANCE.fitness.decay.vo2) + blk.vo2 * vol * iMult * talent * dim(f.vo2)),
    sharpness: cl(f.sharpness * (1 - BALANCE.fitness.decay.sharpness) + blk.sharpness * vol * iMult * talent * dim(f.sharpness)),
  };

  const load = (0.4 + blk.intensity) * vol * 12;
  const acuteLoad = f.acuteLoad * 0.7 + load * 0.3;
  const chronicLoad = f.chronicLoad * 0.92 + load * 0.08;
  const passiveShed = choice.volume === "low" ? BALANCE.fitness.restShed : 2;
  const fatigueAfter = clamp(f.fatigue + blk.fatigue * vol - passiveShed, 0, BALANCE.fitness.fatigueCap);
  const champPrep = clamp(f.champPrep + blk.champPrep * vol, 0, 120);

  const acwr = chronicLoad > 0 ? acuteLoad / chronicLoad : 1;
  const terrain = choice.hillEmphasis ? BALANCE.injury.terrainMult.uphill : BALANCE.injury.terrainMult.flat;
  let pInj = BALANCE.injury.base
    * VOL_RISK[choice.volume]
    * (0.5 + blk.intensity)
    * (a.hidden.injuryProneness / 55)
    * (1 - BALANCE.injury.durabilityRelief * (a.attrs.durability / 99))
    * (1 + fatigueAfter / BALANCE.fitness.fatigueCap)
    * terrain
    * (phil.injuryMult as number)
    * (1 - BALANCE.injury.medicalRelief * medicalFactor);
  if (acwr > BALANCE.fitness.acwrWindow.high) pInj *= BALANCE.injury.acwrSpikePenalty;
  pInj = clamp(pInj, 0, 1);

  let pBurn = 0;
  if (blk.intensity > 0.7 && fatigueAfter > 75 && acwr > BALANCE.fitness.acwrWindow.high) {
    pBurn = clamp(BALANCE.injury.burnoutBase * (fatigueAfter / BALANCE.fitness.fatigueCap) * (2 - (phil.injuryMult as number)), 0, 1);
  }

  return {
    athleteId: a.id,
    name: `${a.firstName} ${a.lastName}`,
    classYear: a.classYear,
    injuryRisk: pInj,
    overtrainRisk: pBurn,
    fatigueBefore: Math.round(f.fatigue),
    fatigueAfter: Math.round(fatigueAfter),
    acwr: Math.round(acwr * 100) / 100,
    sys,
    champPrep,
  };
}

const zero = (): Systems => ({ aerobicBase: 0, lactate: 0, vo2: 0, sharpness: 0 });

/** Project the player's whole healthy roster for a training choice. */
export function previewTraining(p: Program, choice: TrainingChoice): TrainingPreview {
  const healthy = p.roster.filter((a) => a.status.kind === "healthy");
  const n = healthy.length;

  const before = zero();
  const after = zero();
  let fatigueBefore = 0, fatigueAfter = 0, champBefore = 0, champAfter = 0;
  let avgInj = 0;
  let noneDown = 1; // Π(1 − pInj) → P(nobody goes down)
  const atRisk: AthleteTrainingProjection[] = [];

  for (const a of healthy) {
    const pr = projectAthlete(a, choice, p);
    before.aerobicBase += a.fitness.aerobicBase; before.lactate += a.fitness.lactate; before.vo2 += a.fitness.vo2; before.sharpness += a.fitness.sharpness;
    after.aerobicBase += pr.sys.aerobicBase; after.lactate += pr.sys.lactate; after.vo2 += pr.sys.vo2; after.sharpness += pr.sys.sharpness;
    fatigueBefore += a.fitness.fatigue; fatigueAfter += pr.fatigueAfter;
    champBefore += a.fitness.champPrep; champAfter += pr.champPrep;
    avgInj += pr.injuryRisk;
    noneDown *= 1 - pr.injuryRisk;
    atRisk.push({
      athleteId: pr.athleteId, name: pr.name, classYear: pr.classYear,
      injuryRisk: pr.injuryRisk, overtrainRisk: pr.overtrainRisk,
      fatigueBefore: pr.fatigueBefore, fatigueAfter: pr.fatigueAfter, acwr: pr.acwr,
    });
  }

  const avg = (x: number) => (n ? x / n : 0);
  const target = BALANCE.fitness.champPrepTarget;
  const scale = (s: Systems) => ({ aerobicBase: avg(s.aerobicBase), lactate: avg(s.lactate), vo2: avg(s.vo2), sharpness: avg(s.sharpness) });
  const beforeAvg = scale(before);
  const afterAvg = scale(after);
  const fAfter = avg(fatigueAfter);

  atRisk.sort((a, b) => Math.max(b.injuryRisk, b.overtrainRisk) - Math.max(a.injuryRisk, a.overtrainRisk));

  return {
    healthyCount: n,
    before: beforeAvg,
    after: afterAvg,
    deltas: {
      aerobicBase: afterAvg.aerobicBase - beforeAvg.aerobicBase,
      lactate: afterAvg.lactate - beforeAvg.lactate,
      vo2: afterAvg.vo2 - beforeAvg.vo2,
      sharpness: afterAvg.sharpness - beforeAvg.sharpness,
    },
    fatigueBefore: avg(fatigueBefore),
    fatigueAfter: fAfter,
    freshnessAfter: 100 - fAfter,
    avgInjuryRisk: avg(avgInj),
    teamInjuryRisk: n ? 1 - noneDown : 0,
    champPrepBefore: clamp(avg(champBefore) / target, 0, 1.2),
    champPrepAfter: clamp(avg(champAfter) / target, 0, 1.2),
    atRisk,
  };
}
