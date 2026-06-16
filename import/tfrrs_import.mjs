#!/usr/bin/env node
/* Harrier — TFRRS importer
 *
 * Turns TFRRS (tfrrs.org) meet-result pages into the data shape the Harrier
 * engine consumes (athletes / teams / races / results), writing a real_data.js
 * you can load in place of the demo data.js.
 *
 * WHY THIS APPROACH (read me):
 *   You don't "scrape the whole site." You scrape the *result pages you need*
 *   from a list of meet URLs, politely (rate-limited, identified, cached).
 *   TFRRS organizes everything as meets; each meet page links to per-race
 *   result tables. So the pipeline is:
 *       seed meet URLs  →  fetch each (cached)  →  parse race tables  →  emit JS
 *
 * USAGE:
 *   1) Put meet result URLs (one per line) in import/meets.txt, e.g.
 *        https://www.tfrrs.org/results/xc/<id>/<Meet_Name>
 *   2) node import/tfrrs_import.mjs
 *   3) In index.html, swap  data.js  for the generated  real_data.js
 *
 * DEPENDENCIES: node>=18 (global fetch). For robust HTML parsing install
 *   `npm i node-html-parser` — if absent, a regex fallback handles the common
 *   TFRRS table layout but is less resilient.
 *
 * BE A GOOD CITIZEN: TFRRS is a real service. Keep the delay, cache responses,
 * set a contact in USER_AGENT, and check their terms before large pulls.
 */

import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const CACHE_DIR = path.join(HERE, ".cache");
const MEETS_FILE = path.join(HERE, "meets.txt");
const OUT_FILE = path.join(HERE, "..", "real_data.js");
const DELAY_MS = 2500; // polite gap between live fetches
const USER_AGENT = "HarrierImporter/1.0 (contact: you@example.com)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// ---- optional dependency: node-html-parser ----
let parseHTML = null;
try { ({ parse: parseHTML } = await import("node-html-parser")); }
catch { console.warn("· node-html-parser not installed — using regex fallback (npm i node-html-parser for best results)"); }

// ---- cached fetch ----
async function fetchCached(url) {
  await mkdir(CACHE_DIR, { recursive: true });
  const key = createHash("sha1").update(url).digest("hex") + ".html";
  const file = path.join(CACHE_DIR, key);
  try { await stat(file); return await readFile(file, "utf8"); } catch {}
  console.log("  ↓ fetching", url);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const html = await res.text();
  await writeFile(file, html);
  await sleep(DELAY_MS);
  return html;
}

// "24:31.7" / "23:40" / "29:12.55" → seconds (float)
function timeToSeconds(t) {
  const m = String(t).trim().match(/(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const min = m[1] ? parseInt(m[1], 10) : 0;
  return min * 60 + parseFloat(m[2]);
}

// Classify a race table by its header / event title.
function classifyEvent(title) {
  const s = title.toLowerCase();
  if (s.includes("8,000") || s.includes("8k") || s.includes("8000")) return { type: "XC", distanceM: 8000, gender: "M" };
  if (s.includes("6,000") || s.includes("6k") || s.includes("6000")) return { type: "XC", distanceM: 6000, gender: "F" };
  if (s.includes("10,000") || s.includes("10000") || s.includes("10k")) return { type: "TRACK", distanceM: 10000, gender: null };
  if (s.includes("5,000") || s.includes("5000") || s.includes("5k")) return { type: "TRACK", distanceM: 5000, gender: null };
  if (s.includes("women")) return { type: "XC", distanceM: 6000, gender: "F" };
  if (s.includes("men")) return { type: "XC", distanceM: 8000, gender: "M" };
  return null;
}

/* Parse one TFRRS meet page into races[] with embedded result rows.
 * TFRRS pages render each event as a section with a heading and a results
 * <table>. We pull (place, name, athlete link, team, time) per row. */
function parseMeet(html, url) {
  const races = [];
  if (parseHTML) {
    const root = parseHTML(html);
    const titleEl = root.querySelector("h3, .title, title");
    const meetName = (titleEl ? titleEl.text : "Meet").trim().replace(/\s+/g, " ");
    const sections = root.querySelectorAll("table");
    sections.forEach((table) => {
      const heading = (table.previousElementSibling ? table.previousElementSibling.text : "").trim()
        || (table.getAttribute("summary") || "");
      const meta = classifyEvent(heading + " " + meetName);
      if (!meta) return;
      const rows = [];
      table.querySelectorAll("tr").forEach((tr) => {
        const tds = tr.querySelectorAll("td");
        if (tds.length < 3) return;
        const link = tr.querySelector('a[href*="/athletes/"]');
        const name = (link ? link.text : tds[1].text).trim().replace(/\s+/g, " ");
        const athleteUrl = link ? link.getAttribute("href") : null;
        const teamLink = tr.querySelector('a[href*="/teams/"]');
        const team = (teamLink ? teamLink.text : "").trim();
        const timeCell = tds[tds.length - 1].text.trim();
        const seconds = timeToSeconds(timeCell);
        if (name && seconds) rows.push({ name, athleteUrl, team, seconds });
      });
      if (rows.length) races.push({ meetName, heading, meta, rows, url });
    });
  } else {
    // Regex fallback: grab time-bearing rows and the nearest event heading.
    const headingRe = /<h[1-4][^>]*>([^<]+)<\/h[1-4]>/gi;
    const headings = [...html.matchAll(headingRe)].map((m) => m[1].trim());
    const meta = classifyEvent(headings.join(" "));
    if (meta) {
      const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      const rows = [];
      for (const m of html.matchAll(rowRe)) {
        const cells = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => c[1].replace(/<[^>]+>/g, "").trim());
        if (cells.length < 3) continue;
        const seconds = timeToSeconds(cells[cells.length - 1]);
        const name = cells[1];
        if (name && seconds) rows.push({ name, athleteUrl: null, team: cells[2] || "", seconds });
      }
      if (rows.length) races.push({ meetName: headings[0] || "Meet", heading: "", meta, rows, url });
    }
  }
  return races;
}

async function main() {
  let meetUrls;
  try {
    meetUrls = (await readFile(MEETS_FILE, "utf8")).split("\n").map((s) => s.trim()).filter((s) => s && !s.startsWith("#"));
  } catch {
    console.error(`Create ${MEETS_FILE} with one TFRRS meet-result URL per line.`);
    process.exit(1);
  }
  if (!meetUrls.length) { console.error("meets.txt is empty."); process.exit(1); }

  const teams = new Map(), athletes = new Map();
  const RACES = [], RESULTS = [];
  let rid = 1, resId = 1, dateGuess = "2025-09-01";

  for (const url of meetUrls) {
    let html;
    try { html = await fetchCached(url); } catch (e) { console.warn("  ! skip", url, e.message); continue; }
    const races = parseMeet(html, url);
    const dm = url.match(/(20\d{2})/);
    if (dm) dateGuess = `${dm[1]}-10-15`;
    races.forEach((race) => {
      const gender = race.meta.gender || (race.heading.toLowerCase().includes("women") ? "F" : "M");
      const raceId = `r${rid++}`;
      RACES.push({
        id: raceId, meet: race.meetName, type: race.meta.type,
        courseId: slug(race.meetName), courseName: race.meetName, place: "",
        date: dateGuess, weather: 1.0, gender, distanceM: race.meta.distanceM, order: RACES.length,
      });
      race.rows.forEach((row) => {
        const teamId = slug(row.team || "unattached");
        if (!teams.has(teamId)) teams.set(teamId, { id: teamId, name: row.team || "Unattached", abbr: (row.team || "UNA").slice(0, 4).toUpperCase(), conference: "" });
        const aId = row.athleteUrl ? "a-" + slug(row.athleteUrl.split("/").filter(Boolean).pop()) : "a-" + slug(row.name);
        if (!athletes.has(aId)) athletes.set(aId, { id: aId, name: row.name, slug: slug(row.name), teamId, gender, year: "" });
        RESULTS.push({ id: `res${resId++}`, raceId, athleteId: aId, teamId, gender, seconds: Math.round(row.seconds) });
      });
    });
  }

  const TEAMS = [...teams.values()];
  const ATHLETES = [...athletes.values()];
  const banner = `/* Harrier — generated from TFRRS by import/tfrrs_import.mjs. Do not edit by hand. */`;
  const out = `${banner}
(function () {
  "use strict";
  const COURSES = ${JSON.stringify(Object.fromEntries(RACES.map((r) => [r.courseId, { name: r.courseName, place: r.place, factor: 1 }])), null, 0)};
  const TEAMS = ${JSON.stringify(TEAMS)};
  const ATHLETES = ${JSON.stringify(ATHLETES)};
  const RACES = ${JSON.stringify(RACES)};
  const RESULTS = ${JSON.stringify(RESULTS)};
  window.DATA = {
    COURSES, TEAMS, teamById: Object.fromEntries(TEAMS.map((t) => [t.id, t])),
    ATHLETES, athleteById: Object.fromEntries(ATHLETES.map((a) => [a.id, a])),
    RACES, raceById: Object.fromEntries(RACES.map((r) => [r.id, r])), RESULTS,
  };
})();
`;
  await writeFile(OUT_FILE, out);
  console.log(`\n✓ Wrote ${OUT_FILE}`);
  console.log(`  ${ATHLETES.length} athletes · ${TEAMS.length} teams · ${RACES.length} races · ${RESULTS.length} results`);
  console.log(`  Next: in index.html replace  <script src="data.js...">  with  <script src="real_data.js">`);
}

main().catch((e) => { console.error(e); process.exit(1); });
