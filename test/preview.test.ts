import { describe, it, expect } from "vitest";
import { Rng } from "../src/engine/rng";
import { buildLeague } from "../src/engine/league";
import { applyTraining, type TrainCtx } from "../src/engine/training";
import { previewTraining } from "../src/engine/preview";
import type { Program, TrainingChoice } from "../src/engine/types";

function playerWithOneHealthy(): Program {
  const programs = buildLeague(99, "oregon");
  const p = programs.find((x) => x.def.id === "oregon")!;
  // reduce to a single, definitely-healthy athlete for an exact comparison
  const a = p.roster[0];
  a.status = { kind: "healthy" };
  a.fitness.fatigue = 40;
  p.roster = [a];
  return p;
}

const ctxFor = (p: Program, week: number): TrainCtx => ({
  week,
  nationalsWeek: 12,
  medicalFactor: Math.min(1, p.budget.consumables.medical / 60 + p.coach.staff.sportsScientist * 0.12),
  sportsScientist: p.coach.staff.sportsScientist,
  hasLab: p.budget.investments.lab,
});

describe("training preview", () => {
  it("projects the exact fitness a real healthy week produces (no RNG side effects)", () => {
    const p = playerWithOneHealthy();
    const choice: TrainingChoice = { block: "threshold", volume: "med", hillEmphasis: false };

    const pv = previewTraining(p, choice);

    // Apply the real training to a clone; a non-injury week must land on the
    // same fitness numbers the preview projected.
    const clone: Program = structuredClone(p);
    const a = clone.roster[0];
    // use a seed that does not trigger the (very low) injury roll
    applyTraining(a, choice, clone.coach.philosophy, ctxFor(clone, 3), new Rng(123456));

    expect(a.status.kind).toBe("healthy");
    expect(pv.after.aerobicBase).toBeCloseTo(a.fitness.aerobicBase, 5);
    expect(pv.after.lactate).toBeCloseTo(a.fitness.lactate, 5);
    expect(pv.after.vo2).toBeCloseTo(a.fitness.vo2, 5);
    expect(pv.after.sharpness).toBeCloseTo(a.fitness.sharpness, 5);
    expect(pv.fatigueAfter).toBeCloseTo(a.fitness.fatigue, 5);
  });

  it("high-volume VO2 carries more injury + fatigue risk than an easy taper", () => {
    const p = playerWithOneHealthy();
    const hard = previewTraining(p, { block: "vo2", volume: "high", hillEmphasis: false });
    const easy = previewTraining(p, { block: "taper", volume: "low", hillEmphasis: false });
    expect(hard.avgInjuryRisk).toBeGreaterThan(easy.avgInjuryRisk);
    expect(hard.fatigueAfter).toBeGreaterThan(easy.fatigueAfter);
  });

  it("hill emphasis lowers injury risk for the same stimulus", () => {
    const p = playerWithOneHealthy();
    const flat = previewTraining(p, { block: "vo2", volume: "high", hillEmphasis: false });
    const hills = previewTraining(p, { block: "vo2", volume: "high", hillEmphasis: true });
    expect(hills.avgInjuryRisk).toBeLessThan(flat.avgInjuryRisk);
  });

  it("team injury risk rises with roster size for the same per-athlete risk", () => {
    const programs = buildLeague(7, "oregon");
    const p = programs.find((x) => x.def.id === "oregon")!;
    p.roster.forEach((a) => { a.status = { kind: "healthy" }; });
    const choice: TrainingChoice = { block: "vo2", volume: "high", hillEmphasis: false };
    const full = previewTraining(p, choice);
    const one: Program = structuredClone(p);
    one.roster = [one.roster[0]];
    const single = previewTraining(one, choice);
    expect(full.teamInjuryRisk).toBeGreaterThan(single.teamInjuryRisk);
    expect(full.healthyCount).toBeGreaterThan(1);
  });
});
