/**
 * Headless balance simulator.  `npm run simulate -- --seasons 200 [--seed N]`
 *
 * Auto-plays full seasons with AI coaches and reports the balance signals the
 * design calls for: champion distribution/concentration, injury rate, average
 * national finish by coaching philosophy, and whether the top-50 preseason
 * programs dominate the podium (a proxy for talent mattering).
 */
import { buildLeague } from "../src/engine/league";
import { simulateSeason } from "../src/engine/season";
import { runFullOffseason, preseasonReset } from "../src/engine/offseason";
import { generateRecruitPool } from "../src/engine/recruiting";
import { Rng } from "../src/engine/rng";

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const seasons = parseInt(arg("seasons", "50"), 10);
const seed = parseInt(arg("seed", "2026"), 10);

const programs = buildLeague(seed, "oregon");
const top50 = new Set(programs.filter((p) => p.def.isTop50).map((p) => p.def.id));
const nameOf = (id: string) => programs.find((p) => p.def.id === id)?.def.name ?? id;

const champions = new Map<string, number>();
const finishByPhilosophy = new Map<string, { sum: number; n: number }>();
let injuryTotal = 0, athleteWeeks = 0, top50Podiums = 0, podiums = 0;

const t0 = Date.now();
for (let s = 0; s < seasons; s++) {
  const year = 2026 + s;
  preseasonReset(programs);
  const res = simulateSeason(programs, seed + s, year);

  champions.set(res.champion, (champions.get(res.champion) ?? 0) + 1);
  injuryTotal += res.injuriesDuringSeason;
  athleteWeeks += programs.reduce((n, p) => n + p.roster.length, 0) * 12;

  // podium (top 3) share that are preseason top-50 programs
  for (const id of res.nationalsOrder.slice(0, 3)) { podiums++; if (top50.has(id)) top50Podiums++; }

  // average national finish by philosophy (DNQ counts as 45)
  const finishMap = new Map<string, number>();
  res.nationalsOrder.forEach((id, i) => finishMap.set(id, i + 1));
  for (const p of programs) {
    const f = finishMap.get(p.def.id) ?? 45;
    const e = finishByPhilosophy.get(p.aiPhilosophy) ?? { sum: 0, n: 0 };
    e.sum += f; e.n++;
    finishByPhilosophy.set(p.aiPhilosophy, e);
  }

  runFullOffseason(programs, generateRecruitPool(new Rng(seed + s), year), new Rng(seed + s).fork(`off:${year}`));
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);

const champCounts = [...champions.values()].sort((a, b) => b - a);
const distinctChampions = champions.size;
const herfindahl = champCounts.reduce((s, c) => s + (c / seasons) ** 2, 0); // 1 = monopoly

console.log(`=== Balance report — ${seasons} seasons (seed ${seed}, ${secs}s) ===\n`);

console.log("Champion distribution:");
console.log(`  distinct champions: ${distinctChampions}  concentration (HHI): ${herfindahl.toFixed(3)} (lower = more parity)`);
[...champions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  .forEach(([id, n]) => console.log(`    ${nameOf(id).padEnd(16)} ${n} (${((n / seasons) * 100).toFixed(0)}%)`));

console.log(`\nInjuries: ${(injuryTotal / athleteWeeks * 1000).toFixed(2)} per 1000 athlete-weeks`);

console.log(`\nPodium share from preseason top-50 programs: ${(top50Podiums / podiums * 100).toFixed(0)}% (talent should matter)`);

console.log("\nAverage national finish by coaching philosophy (lower = better; 45 = DNQ):");
[...finishByPhilosophy.entries()].sort((a, b) => a[1].sum / a[1].n - b[1].sum / b[1].n)
  .forEach(([phil, e]) => console.log(`    ${phil.padEnd(11)} ${(e.sum / e.n).toFixed(1)}  (n=${e.n})`));
