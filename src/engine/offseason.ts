/**
 * Offseason flow: transfer portal departures, graduations + development
 * (with summer-camp boost), AI recruiting, and prestige/expectation updates.
 */
import { Rng, clamp } from "./rng";
import { developAthlete } from "./training";
import { campBoost } from "./economy";
import { runRecruitingAI } from "./recruiting";
import { setExpectations } from "./career";
import type { Program, Recruit } from "./types";

/** Athletes with high portal risk / low morale may transfer out. */
export function runPortal(programs: Program[], rng: Rng): Record<string, string[]> {
  const departures: Record<string, string[]> = {};
  for (const p of programs) {
    const r = rng.fork(`portal:${p.def.id}`);
    const leaving: string[] = [];
    p.roster = p.roster.filter((a) => {
      if (a.eligibilityLeft <= 1) return true; // seniors handled by graduation
      const pLeave = clamp(a.portalRisk / 300 + (a.attrs.morale < 45 ? 0.1 : 0), 0, 0.5);
      if (r.chance(pLeave)) { leaving.push(a.id); return false; }
      return true;
    });
    if (leaving.length) departures[p.def.id] = leaving;
  }
  return departures;
}

/** Graduate out-of-eligibility athletes; develop + age the rest. */
export function graduateAndDevelop(programs: Program[], rng: Rng): void {
  for (const p of programs) {
    const camp = campBoost(p);
    const philFit = (p.coach.philosophy === "balanced" ? 1.05 : 1.0) * (0.85 + p.coach.reputation / 300) * camp;
    p.roster = p.roster.filter((a) => a.eligibilityLeft > 0 && a.classYear !== "GRAD");
    for (const a of p.roster) developAthlete(a, clamp(philFit, 0.8, 1.4), rng.fork(`dev:${a.id}`));
  }
}

/** Full offseason for the whole league (AI programs auto-recruit). */
export function runFullOffseason(programs: Program[], pool: Recruit[], rng: Rng): void {
  runPortal(programs, rng);
  graduateAndDevelop(programs, rng);
  runRecruitingAI(programs, pool, rng);
  setExpectations(programs);
}

/** Preseason reset: detrain over summer — keep aerobic base, shed fatigue and
 * most sharpness, and clear the season-long champPrep/peak trackers. */
export function preseasonReset(programs: Program[]): void {
  for (const p of programs) {
    for (const a of p.roster) {
      const f = a.fitness;
      f.fatigue = clamp(f.fatigue, 0, 18);
      f.sharpness = Math.round(f.sharpness * 0.4);
      f.vo2 = Math.round(f.vo2 * 0.75);
      f.champPrep = 0;
      f.peakWeek = 0;
      f.acuteLoad = 20;
      f.chronicLoad = 20;
    }
  }
}
