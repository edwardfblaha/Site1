import { describe, it, expect } from "vitest";
import { Rng, hashSeed } from "../src/engine/rng";

describe("Rng determinism", () => {
  it("same seed → identical stream", () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("different seeds → different streams", () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toEqual(b.next());
  });

  it("cursor resume replays identically", () => {
    const a = new Rng(777);
    for (let i = 0; i < 50; i++) a.next();
    const cont = Array.from({ length: 20 }, () => a.next());
    const resumed = new Rng(777, 50); // reconstruct from saved cursor
    const cont2 = Array.from({ length: 20 }, () => resumed.next());
    expect(cont2).toEqual(cont);
    expect(resumed.cursor).toBe(70);
  });

  it("fork is stable and independent of parent usage", () => {
    const p1 = new Rng(99);
    const c1 = p1.fork("athlete:42").next();
    const p2 = new Rng(99);
    for (let i = 0; i < 1000; i++) p2.next(); // heavily use parent
    const c2 = p2.fork("athlete:42").next();
    expect(c1).toEqual(c2);
  });

  it("int is within inclusive bounds", () => {
    const r = new Rng(5);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });

  it("gauss is roughly centered", () => {
    const r = new Rng(8);
    let sum = 0;
    const n = 5000;
    for (let i = 0; i < n; i++) sum += r.gauss(50, 10);
    const mean = sum / n;
    expect(Math.abs(mean - 50)).toBeLessThan(1.5);
  });

  it("weighted respects zero weights", () => {
    const r = new Rng(3);
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 1000; i++) {
      counts[r.weighted(["a", "b", "c"], [1, 0, 1]) as "a" | "b" | "c"]++;
    }
    expect(counts.b).toBe(0);
    expect(counts.a).toBeGreaterThan(0);
    expect(counts.c).toBeGreaterThan(0);
  });

  it("hashSeed is pure", () => {
    expect(hashSeed(10, "key")).toEqual(hashSeed(10, "key"));
    expect(hashSeed(10, "key")).not.toEqual(hashSeed(10, "other"));
  });
});
