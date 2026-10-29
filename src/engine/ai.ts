/**
 * AI coach decision policies: periodized training by calendar week (modulated
 * by philosophy and competence) and lineup selection. Competence scales with
 * coach reputation so the league has strong and weak staffs.
 */
import { Rng, clamp } from "./rng";
import type { Athlete, Program, TrainingChoice, Philosophy, VolumeLevel, TrainingBlock } from "./types";

/** Periodized block for a week (0 = season start … nationalsWeek). */
export function aiTrainingChoice(
  philosophy: Philosophy, week: number, nationalsWeek: number, competence: number, rng: Rng
): TrainingChoice {
  const frac = clamp(week / Math.max(1, nationalsWeek), 0, 1);
  let block: TrainingBlock;
  let volume: VolumeLevel;

  if (frac < 0.25) { block = rng.chance(0.5) ? "base" : "longRun"; volume = "high"; }
  else if (frac < 0.5) { block = "threshold"; volume = "high"; }
  else if (frac < 0.72) { block = rng.chance(0.5) ? "vo2" : "threshold"; volume = "med"; }
  else if (frac < 0.9) { block = "raceSpecific"; volume = "med"; }
  else if (frac < 0.97) { block = "sharpening"; volume = "low"; }
  else { block = "taper"; volume = "low"; }

  // Philosophy tilt.
  if (philosophy === "lydiard" && frac < 0.55 && rng.chance(0.5)) { block = "base"; volume = "high"; }
  if (philosophy === "intensity" && frac >= 0.35 && frac < 0.72) { block = "vo2"; }
  if (philosophy === "norwegian" && frac >= 0.3 && frac < 0.85 && rng.chance(0.6)) { block = "threshold"; volume = "high"; }
  if (philosophy === "altitude" && frac < 0.4) { block = "base"; }

  // Low-competence coaches mis-time blocks (peak early / over-race).
  if (rng.chance((1 - competence) * 0.35)) {
    block = rng.pick(["vo2", "raceSpecific", "sharpening"] as TrainingBlock[]);
    if (frac < 0.3) volume = "high"; // classic early-peaking mistake
  }

  const hillEmphasis = rng.chance(0.4); // some coaches favor safer hill intensity
  return { block, volume, hillEmphasis };
}

/** Project an athlete's current race strength for lineup ordering. */
export function projectedStrength(a: Athlete): number {
  const fit = (a.fitness.aerobicBase * 0.4 + a.fitness.lactate * 0.3 + a.fitness.vo2 * 0.2 + a.fitness.sharpness * 0.1);
  const fresh = clamp(1 - a.fitness.fatigue / 99, 0.4, 1);
  const attr = (a.attrs.aerobic + a.attrs.threshold + a.attrs.speed) / 3;
  return (fit * 0.6 + attr * 0.4) * fresh;
}

/** Pick up to `n` healthy runners, strongest first. */
export function aiLineup(program: Program, n = 7): Athlete[] {
  return program.roster
    .filter((a) => a.status.kind === "healthy")
    .sort((a, b) => projectedStrength(b) - projectedStrength(a))
    .slice(0, n);
}

export function competenceOf(program: Program): number {
  return clamp(0.4 + program.coach.reputation / 160, 0.4, 1);
}
