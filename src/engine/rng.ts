/**
 * Seeded, deterministic RNG. Same seed + same call sequence ⇒ same output,
 * always. No Math.random, no Date — the engine's only entropy source.
 *
 * Implementation: mulberry32 (fast, good distribution for a game). The `cursor`
 * makes the stream resumable: persist seed + cursor in the save and a reload
 * replays identically. Derive independent sub-streams with `fork(key)` so, e.g.,
 * each athlete's development can advance without consuming the main stream.
 */
export class Rng {
  readonly seed: number;
  private state: number;
  cursor: number;

  constructor(seed: number, cursor = 0) {
    this.seed = seed >>> 0;
    this.state = this.seed;
    this.cursor = 0;
    // Advance to the requested cursor so saves resume exactly.
    while (this.cursor < cursor) this.next();
  }

  /** Raw next in [0,1). Advances the stream by one step. */
  next(): number {
    this.cursor++;
    let t = (this.state += 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [min, max). */
  float(min = 0, max = 1): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Standard normal via Box–Muller (deterministic, uses two draws). */
  gauss(mean = 0, sd = 1): number {
    const u = Math.max(1e-12, this.next());
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Uniform pick from a non-empty array. */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  /** Pick by weight. weights[i] ≥ 0; at least one > 0. */
  weighted<T>(arr: readonly T[], weights: readonly number[]): T {
    const total = weights.reduce((s, w) => s + w, 0);
    let r = this.next() * total;
    for (let i = 0; i < arr.length; i++) {
      r -= weights[i];
      if (r < 0) return arr[i];
    }
    return arr[arr.length - 1];
  }

  /** In-place Fisher–Yates shuffle (returns the same array). */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Derive an independent child RNG from a string/number key. Deterministic:
   * same parent seed + same key ⇒ same child stream, regardless of how much
   * the parent has been used. Used to isolate per-entity randomness.
   */
  fork(key: string | number): Rng {
    return new Rng(hashSeed(this.seed, String(key)));
  }
}

/** FNV-1a-style mix of a base seed and a string into a new 32-bit seed. */
export function hashSeed(base: number, key: string): number {
  let h = (base ^ 0x811c9dc5) >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Clamp a number to [lo, hi]. */
export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}
