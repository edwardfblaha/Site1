#!/usr/bin/env node
/* Harrier — build real_data.js from manually-imported TFRRS performance lists.
 *
 * Input: import/list_5k.txt and import/list_10k.txt, one athlete per line:
 *     Last, First|YR-n|Team|TIME|Meet name|Mon DD, YYYY
 *
 * These are 2026 DI men season-best performance lists for the 5,000m and
 * 10,000m. We do NOT rank by converting times. Instead we build head-to-head
 * "races": for each (meet, event) we order the listed athletes by time, which
 * yields who-finished-ahead-of-whom evidence. Athletes who appear in both lists
 * become one athlete, so their 5k and 10k results connect the two lists into a
 * single national picture. The engine then solves the same Massey-style rating.
 *
 * Run:  node import/build_from_lists.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT_FILE = path.join(HERE, "..", "real_data.js");

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const MONTHS = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

function isoDate(s) {
  // "Apr 16, 2026" -> "2026-04-16"
  const m = String(s).trim().match(/([A-Za-z]{3})\w*\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return "2026-01-01";
  return `${m[3]}-${MONTHS[m[1]] || "01"}-${String(m[2]).padStart(2, "0")}`;
}

function timeToSeconds(t) {
  const m = String(t).replace(/[^0-9:.]/g, "").match(/(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return (m[1] ? parseInt(m[1], 10) : 0) * 60 + parseFloat(m[2]);
}

function teamAbbr(name) {
  const words = name.replace(/[^A-Za-z0-9 .&'-]/g, "").split(/\s+/).filter(Boolean);
  if (words.length >= 2) return words.map((w) => w[0]).join("").slice(0, 4).toUpperCase();
  return name.slice(0, 4).toUpperCase();
}

async function parseList(file, distanceM) {
  let text;
  try { text = await readFile(path.join(HERE, file), "utf8"); }
  catch { console.warn("  ! missing", file); return []; }
  const rows = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split("|").map((s) => s.trim());
    if (parts.length < 6) continue;
    const [name, year, team, time, meet, date] = parts;
    const seconds = timeToSeconds(time);
    if (!name || !team || !seconds) continue;
    rows.push({ name, year: (year || "").split("-")[0], team, seconds,
      meet, date: isoDate(date), distanceM });
  }
  return rows;
}

async function main() {
  const rows = [
    ...(await parseList("list_5k.txt", 5000)),
    // 10,000m list is staged in list_10k.txt but excluded from the build for
    // now; add it back here to weigh both events once it's complete.
    // ...(await parseList("list_10k.txt", 10000)),
  ];
  if (!rows.length) { console.error("✗ no rows parsed"); process.exit(2); }

  // ---- athletes (merge across events by name+team) and teams ----
  const teams = new Map(), athletes = new Map();
  for (const r of rows) {
    const teamId = slug(r.team);
    if (!teams.has(teamId))
      teams.set(teamId, { id: teamId, name: r.team, abbr: teamAbbr(r.team), conference: "" });
    const aId = "a-" + slug(r.name) + "-" + teamId;
    if (!athletes.has(aId))
      athletes.set(aId, { id: aId, name: r.name, slug: slug(r.name), teamId, gender: "M", year: r.year });
    r.athleteId = aId;
    r.teamId = teamId;
  }

  // ---- races: one per (meet, event); finishers ordered by time ----
  const raceGroups = new Map();
  for (const r of rows) {
    const key = `${r.distanceM}|${slug(r.meet)}`;
    if (!raceGroups.has(key)) raceGroups.set(key, { meet: r.meet, distanceM: r.distanceM, date: r.date, rows: [] });
    raceGroups.get(key).rows.push(r);
  }

  // Order races chronologically so later meets carry more recency weight.
  const groups = [...raceGroups.values()].sort((a, b) => a.date.localeCompare(b.date));
  const RACES = [], RESULTS = [];
  let rid = 1, resId = 1;
  groups.forEach((g, i) => {
    if (g.rows.length < 2) return; // a lone performance creates no head-to-head edge
    const raceId = `r${rid++}`;
    RACES.push({
      id: raceId, meet: g.meet, type: "TRACK",
      courseId: slug(g.meet), courseName: g.meet, place: "",
      date: g.date, weather: 1.0, gender: "M", distanceM: g.distanceM, order: i,
    });
    g.rows.forEach((row) => {
      RESULTS.push({ id: `res${resId++}`, raceId, athleteId: row.athleteId,
        teamId: row.teamId, gender: "M", seconds: Math.round(row.seconds) });
    });
  });

  // Keep only athletes (and their teams) that actually have head-to-head results.
  const usedAthletes = new Set(RESULTS.map((r) => r.athleteId));
  const ATHLETES = [...athletes.values()].filter((a) => usedAthletes.has(a.id));
  const usedTeams = new Set(ATHLETES.map((a) => a.teamId));
  const TEAMS = [...teams.values()].filter((t) => usedTeams.has(t.id));
  const COURSES = Object.fromEntries(RACES.map((r) => [r.courseId, { name: r.courseName, place: "", factor: 1 }]));

  const out = `/* Harrier — generated from manually-imported 2026 DI men 5k/10k TFRRS
   performance lists by import/build_from_lists.mjs. Do not edit by hand. */
(function () {
  "use strict";
  const COURSES = ${JSON.stringify(COURSES)};
  const TEAMS = ${JSON.stringify(TEAMS)};
  const ATHLETES = ${JSON.stringify(ATHLETES)};
  const RACES = ${JSON.stringify(RACES)};
  const RESULTS = ${JSON.stringify(RESULTS)};
  window.DATA = { COURSES, TEAMS, teamById: Object.fromEntries(TEAMS.map((t) => [t.id, t])),
    ATHLETES, athleteById: Object.fromEntries(ATHLETES.map((a) => [a.id, a])),
    RACES, raceById: Object.fromEntries(RACES.map((r) => [r.id, r])), RESULTS };
})();
`;
  await writeFile(OUT_FILE, out);
  console.log(`✓ ${path.relative(process.cwd(), OUT_FILE)}: ${ATHLETES.length} athletes · ${TEAMS.length} teams · ${RACES.length} races · ${RESULTS.length} results`);
}

main().catch((e) => { console.error(e); process.exit(1); });
