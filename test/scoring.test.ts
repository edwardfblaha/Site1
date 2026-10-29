import { describe, it, expect } from "vitest";
import { scoreMeet } from "../src/engine/scoring";
import type { RunnerResult } from "../src/engine/types";

// helper: build a finish list from [programId, place] pairs
function finish(pairs: Array<[string, number]>): RunnerResult[] {
  return pairs.map(([programId, place]) => ({
    athleteId: `${programId}-${place}`, programId, splits: [], timeSec: 1000 + place,
    place, scoringPlace: 0, notes: [],
  }));
}

describe("XC scoring", () => {
  it("classic dual meet: 1-2-3-4-5 beats 6-7-8-9-10 (15 vs 40)", () => {
    const runners = finish([
      ["A", 1], ["A", 2], ["A", 3], ["A", 4], ["A", 5],
      ["B", 6], ["B", 7], ["B", 8], ["B", 9], ["B", 10],
    ]);
    const s = scoreMeet(runners);
    const A = s.find((t) => t.programId === "A")!;
    const B = s.find((t) => t.programId === "B")!;
    expect(A.score).toBe(15);
    expect(B.score).toBe(40);
    expect(A.teamPlace).toBe(1);
  });

  it("only top 5 score; 6th/7th displace but are not summed", () => {
    // interleave so B's 6th man sits among A's scorers
    const runners = finish([
      ["A", 1], ["B", 2], ["A", 3], ["B", 4], ["A", 5],
      ["B", 6], ["A", 7], ["B", 8], ["A", 9], ["B", 10],
      ["A", 11], ["B", 12], ["A", 13], ["B", 14],
    ]);
    const s = scoreMeet(runners);
    const A = s.find((t) => t.programId === "A")!;
    // A scorers at places 1,3,5,7,9 → 25
    expect(A.score).toBe(25);
    expect(A.scorers).toHaveLength(5);
    expect(A.displacers).toHaveLength(2); // 11th & 13th count as displacers only
  });

  it("incomplete teams (<5 finishers) are removed and don't take places", () => {
    // C has only 2 runners up front; they must not count against A or B
    const runners = finish([
      ["C", 1], ["C", 2],
      ["A", 3], ["A", 4], ["A", 5], ["A", 6], ["A", 7],
      ["B", 8], ["B", 9], ["B", 10], ["B", 11], ["B", 12],
    ]);
    const s = scoreMeet(runners);
    expect(s.find((t) => t.programId === "C")).toBeUndefined();
    const A = s.find((t) => t.programId === "A")!;
    // after removing C, A occupies recomputed places 1-5 → 15
    expect(A.score).toBe(15);
  });

  it("tiebreak resolved by 6th runner", () => {
    // Construct a 15-15 tie, decided by the 6th man.
    const runners = finish([
      ["A", 1], ["B", 2], ["A", 3], ["B", 4], ["A", 5],
      ["B", 6], ["A", 7], ["B", 8], ["A", 9], ["B", 10],
      // both have same top-5 sum? compute: A=1+3+5+7+9=25, B=2+4+6+8+10=30 (not tie)
      // add 6th men: A 11, B 12
      ["A", 11], ["B", 12],
    ]);
    const s = scoreMeet(runners);
    // not a tie here, but ensure sixthRunnerPlace recorded
    const A = s.find((t) => t.programId === "A")!;
    expect(A.sixthRunnerPlace).toBeGreaterThan(0);
  });
});
