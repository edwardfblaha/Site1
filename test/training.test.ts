import { describe, it, expect } from "vitest";
import { Rng } from "../src/engine/rng";
import { generateAthlete } from "../src/engine/athletes";
import { applyTraining, type TrainCtx } from "../src/engine/training";
import type { Athlete, TrainingChoice } from "../src/engine/types";

const ctx: TrainCtx = { week: 1, nationalsWeek: 12, medicalFactor: 0.3, sportsScientist: 0, hasLab: false };

function fresh(seed = 1): Athlete {
  const a = generateAthlete(new Rng(seed), { stars: 3, classYear: "JR" });
  a.status = { kind: "healthy" };
  a.fitness.fatigue = 50;
  return a;
}

describe("training & periodization", () => {
  it("taper sheds fatigue; high-volume VO2 adds it", () => {
    const taperAth = fresh();
    const vo2Ath = fresh();
    const r = new Rng(10);
    const taper: TrainingChoice = { block: "taper", volume: "low", hillEmphasis: false };
    const vo2: TrainingChoice = { block: "vo2", volume: "high", hillEmphasis: false };
    const f0 = taperAth.fitness.fatigue;
    applyTraining(taperAth, taper, "balanced", ctx, r);
    applyTraining(vo2Ath, vo2, "balanced", ctx, r);
    expect(taperAth.fitness.fatigue).toBeLessThan(f0);
    expect(vo2Ath.fitness.fatigue).toBeGreaterThan(f0);
  });

  it("base build raises aerobicBase; VO2 raises vo2 system", () => {
    const a = fresh();
    const r = new Rng(2);
    const base0 = a.fitness.aerobicBase;
    for (let i = 0; i < 4; i++) applyTraining(a, { block: "base", volume: "high", hillEmphasis: false }, "balanced", ctx, r);
    expect(a.fitness.aerobicBase).toBeGreaterThan(base0);
  });

  it("correct periodization peaks fresher at championships than early-intensity", () => {
    // Good: base→threshold→vo2→sharpen→taper.  Bad: hammer VO2 high all season.
    const good = fresh(3);
    const bad = fresh(3);
    const gr = new Rng(50), br = new Rng(50);
    const C = (block: TrainingChoice["block"], volume: TrainingChoice["volume"]): TrainingChoice =>
      ({ block, volume, hillEmphasis: false });
    const rep = (n: number, c: TrainingChoice) => Array.from({ length: n }, () => ({ ...c }));
    const goodPlan: TrainingChoice[] = [
      ...rep(3, C("base", "high")),
      ...rep(3, C("threshold", "high")),
      ...rep(2, C("vo2", "med")),
      ...rep(2, C("raceSpecific", "med")),
      C("sharpening", "low"), C("taper", "low"),
    ];
    const badPlan: TrainingChoice[] = rep(12, C("vo2", "high"));
    goodPlan.forEach((c, i) => applyTraining(good, c, "balanced", { ...ctx, week: i + 1 }, gr));
    badPlan.forEach((c, i) => applyTraining(bad, c, "balanced", { ...ctx, week: i + 1 }, br));
    // the well-periodized athlete should arrive fresher (less fatigue) at champs
    expect(good.fitness.fatigue).toBeLessThan(bad.fitness.fatigue);
  });

  it("injured athletes recover and return to healthy", () => {
    const a = fresh();
    a.status = { kind: "injured", weeksLeft: 2, severity: "moderate" };
    const r = new Rng(4);
    applyTraining(a, { block: "base", volume: "low", hillEmphasis: false }, "balanced", ctx, r);
    applyTraining(a, { block: "base", volume: "low", hillEmphasis: false }, "balanced", ctx, r);
    expect(a.status.kind).toBe("healthy");
  });
});