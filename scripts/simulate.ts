/**
 * Headless balance simulator (CLI).  `npm run simulate -- --seasons 200`
 *
 * Phase 1: this is a stub that builds the league and reports roster/talent
 * distribution so we can sanity-check generation. Later phases add full
 * auto-played seasons with AI coaches and the balance stats the design calls
 * for (champion distribution, injury rates, average finish by strategy).
 */
import { buildLeague, LEAGUE } from "../src/engine";

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const seasons = parseInt(arg("seasons", "1"), 10);
const seed = parseInt(arg("seed", "2026"), 10);

const programs = buildLeague(seed, "oregon");
const allAthletes = programs.flatMap((p) => p.roster);

const starCounts = [0, 0, 0, 0, 0, 0];
for (const a of allAthletes) starCounts[a.starRating]++;
const intl = allAthletes.filter((a) => a.international).length;

console.log("=== Cross Country Manager — headless simulator (Phase 1 stub) ===");
console.log(`seed=${seed}  seasons requested=${seasons}`);
console.log(`programs: ${programs.length}  athletes: ${allAthletes.length}`);
console.log(`regions: ${LEAGUE.regions.length}  conferences: ${Object.keys(LEAGUE.conferences).length}`);
console.log(`international share: ${((intl / allAthletes.length) * 100).toFixed(1)}%`);
console.log("star distribution (1→5): " + starCounts.slice(1).join(" / "));
console.log("\nFull-season auto-play + balance stats arrive in Phase 3/7.");
