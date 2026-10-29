/**
 * Headless balance simulator (CLI).  `npm run simulate -- --seasons 200`
 *
 * Phase 2: simulates one regular-season meet between real league programs and
 * prints the team scores + the winning team's five scorers with splits — the
 * "headless sim of one regular-season meet" deliverable. Full multi-season
 * auto-play + balance stats arrive in Phase 3/7.
 */
import { Rng } from "../src/engine/rng";
import { buildLeague, findProgram } from "../src/engine/league";
import { simulateMeet, type RaceEntrant } from "../src/engine/meet";
import type { Meet, Program } from "../src/engine/types";

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const seed = parseInt(arg("seed", "2026"), 10);
const programs = buildLeague(seed, "oregon");
const rng = new Rng(seed).fork("sim:meet1");

// Pick 8 strong programs for a marquee early-season invitational.
const field = [...programs].sort((a, b) => b.prestige - a.prestige).slice(0, 8);

function lineup(p: Program): RaceEntrant {
  const healthy = p.roster.filter((a) => a.status.kind === "healthy");
  const seven = [...healthy].sort((a, b) => b.starRating - a.starRating).slice(0, 7);
  return { programId: p.def.id, athletes: seven, shoeTier: p.budget.investments.shoeTier };
}

const meet: Meet = {
  id: "madison-inv", name: "Madison Invitational", tier: "regular", week: 4,
  prestige: 80, travelCost: 20,
  course: { distance: 8000, terrain: 0.35, firmness: 0.7, altitude: 260 },
};

const result = simulateMeet(meet, field.map(lineup), rng);

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
const name = (id: string) => findProgram(programs, id)!.def.name;

console.log(`=== ${meet.name} — ${meet.course.distance / 1000}k (seed ${seed}) ===\n`);
console.log("Team scores:");
for (const t of result.teamScores) {
  console.log(`  ${String(t.teamPlace).padStart(2)}. ${name(t.programId).padEnd(16)} ${String(t.score).padStart(4)}  (6th: ${t.sixthRunnerPlace})`);
}

const champ = result.teamScores[0];
console.log(`\nWinning team: ${name(champ.programId)} — scorers:`);
for (const aid of champ.scorers) {
  const r = result.runners.find((x) => x.athleteId === aid)!;
  const prog = findProgram(programs, champ.programId)!;
  const ath = prog.roster.find((a) => a.id === aid)!;
  console.log(`  ${String(r.place).padStart(3)}  ${(ath.firstName + " " + ath.lastName).padEnd(22)} ${fmt(r.timeSec)}  ${r.notes[0] ?? ""}`);
}
console.log(`\n${result.runners.length} finishers · ${result.teamScores.length} complete teams.`);
