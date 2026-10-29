/**
 * Coach career: preseason expectations from prestige, reputation + prestige
 * updates from results, firing for sustained underperformance, and job offers
 * from stronger programs when overperforming.
 */
import { Rng, clamp } from "./rng";
import type { Program } from "./types";

/** Expected national finish bucket (lower is better; 99 = "just make regionals"). */
export function expectationFor(prestige: number): number {
  if (prestige >= 92) return 3;
  if (prestige >= 85) return 8;
  if (prestige >= 75) return 18;
  if (prestige >= 62) return 31;   // make nationals
  return 99;                        // be competitive regionally
}

export function setExpectations(programs: Program[]): void {
  for (const p of programs) p.seasonExpectation = expectationFor(p.prestige);
}

export interface CareerUpdate {
  reputationDelta: number;
  prestigeDelta: number;
  metExpectation: boolean;
}

/** Update a program's coach reputation + prestige from a season outcome. */
export function updateCareer(p: Program, finish: number | null): CareerUpdate {
  const expectation = p.seasonExpectation || expectationFor(p.prestige);
  const actual = finish ?? 45; // didn't qualify ≈ 45th
  const beat = expectation - actual; // positive = overperformed
  const repDelta = clamp(Math.round(beat * 0.6), -12, 15);
  const presDelta = clamp(Math.round(beat * 0.25), -4, 5);
  p.coach.reputation = clamp(p.coach.reputation + repDelta, 1, 99);
  p.coach.xp += Math.max(0, beat) + 5;
  p.prestige = clamp(p.prestige + presDelta, 20, 99);
  // unlock philosophies as reputation grows
  p.coach.unlocked = (["lydiard", "balanced", "intensity", "altitude", "norwegian"] as const)
    .filter((ph) => p.coach.reputation >= unlockRep(ph));
  return { reputationDelta: repDelta, prestigeDelta: presDelta, metExpectation: actual <= expectation };
}

function unlockRep(ph: string): number {
  return ({ lydiard: 0, balanced: 0, intensity: 35, altitude: 50, norwegian: 70 } as Record<string, number>)[ph] ?? 0;
}

export interface JobOffer { programId: string; programName: string; prestige: number; }

/** Job offers to the player from stronger programs after a strong season. */
export function jobOffers(programs: Program[], player: Program, result: { playerNationalFinish: number | null }, rng: Rng): JobOffer[] {
  const finish = result.playerNationalFinish ?? 45;
  const overperformed = finish < (player.seasonExpectation || 20) - 3;
  if (!overperformed) return [];
  const offers = programs
    .filter((p) => !p.isPlayer && p.prestige > player.prestige + 4 && p.prestige <= player.prestige + 22)
    .sort((a, b) => b.prestige - a.prestige)
    .slice(0, 3)
    .filter(() => rng.chance(0.6))
    .map((p) => ({ programId: p.def.id, programName: p.def.name, prestige: p.prestige }));
  return offers;
}

/** Is the coach fired? Sustained finishes far worse than expectation. */
export function shouldFire(history: number[], expectation: number): boolean {
  if (history.length < 3) return false;
  const last3 = history.slice(-3);
  return last3.every((f) => (f ?? 45) > expectation + 12);
}
