#!/usr/bin/env node
/* Harrier — TFRRS importer (automatic, no manual race-by-race paste)
 *
 * Pulls real NCAA Division I results and writes ../real_data.js for the engine.
 *
 * TWO MODES (both automatic — you do NOT paste individual meet URLs):
 *
 *   A) LIST MODE (default, best for "preliminary rankings from 2026 5k/10k"):
 *      Reads TFRRS performance-list pages for the events you want (e.g. DI men
 *      5000m and 10000m for the 2026 season). Each list row is athlete + team +
 *      time. To create head-to-head edges we also follow each *meet* linked from
 *      the list so the engine sees who actually raced whom. Discovery is
 *      automatic from the list pages — no manual meet collection.
 *
 *   B) CRAWL MODE: give it one or more TFRRS index/team/conference URLs and it
 *      discovers every meet link beneath them and imports those.
 *
 * CONFIGURE at the top of CONFIG below (season, division, gender, events).
 *
 * RUN:
 *   node import/tfrrs_import.mjs            # list mode with CONFIG
 *   node import/tfrrs_import.mjs --crawl URL1 URL2 ...
 *
 * NETWORK NOTE: this must run somewhere that can reach tfrrs.org. Some sandboxed
 * environments block outbound traffic (you'll see "Host not in allowlist"); run
 * it on your own machine or a host where tfrrs.org is reachable.
 *
 * BE A GOOD CITIZEN: requests are rate-limited and cached in import/.cache/.
 * Set a real contact in USER_AGENT and review TFRRS terms before large pulls.
 */

import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const CACHE_DIR = path.join(HERE, ".cache");
const OUT_FILE = path.join(HERE, "..", "real_data.js");
const DELAY_MS = 2500;
const USER_AGENT = "HarrierImporter/1.1 (contact: you@example.com)";

/* ─────────────────────────── CONFIG ───────────────────────────
 * Preliminary DI men rankings from the 2026 track season 5k/10k.
 * The list "hnd" ids are TFRRS event codes; the importer also accepts full
 * list URLs if you'd rather paste those. Update season/list IDs each year. */
const CONFIG = {
  division: "DI",
  gender: "M",
  season: "2026",
  // Direct meet result pages to import. We parse each for its 5000m / 10000m
  // tables (and follow event sub-pages if the meet splits events out). These
  // are the 2026 conference + NCAA-qualifying meets that seed the preliminary
  // DI men's rankings from real head-to-head 5k/10k results.
  meetUrls: [
    "https://www.tfrrs.org/results/96875/NCAA_Division_I_Outdoor_Track__Field_Championships",
    "https://www.tfrrs.org/results/96717/NCAA_Division_I_West_First_Rounds",
    "https://www.tfrrs.org/results/96716/NCAA_Division_I_East_First_Rounds",
    "https://www.tfrrs.org/results/96168/2026_CAA_Outdoor_Track__Field_Championship",
    "https://www.tfrrs.org/results/94457/2026_Patriot_League_Outdoor_Track_and_Field_Championships_",
    "https://www.tfrrs.org/results/96121/2026_Big_Ten_Outdoor_Track__Field_Championships",
    "https://www.tfrrs.org/results/94673/Big_12_Outdoor_Track__Field_Championships",
    "https://www.tfrrs.org/results/96485/2026_BIG_EAST_Outdoor_Track__Field_Championships",
    "https://www.tfrrs.org/results/96715/2026_Conference_USA_Outdoor_Track__Field_Championships",
    "https://www.tfrrs.org/results/96148/SEC_Outdoor_TF_Championships_2026",
    "https://www.tfrrs.org/results/96788/Big_Sky_Outdoor_Track__Field_Championships",
    "https://www.tfrrs.org/results/96410/The_2026_American_Outdoor_Track__Field_Championships",
    "https://www.tfrrs.org/results/93684/2026_MEAC_Outdoor_Track__Field_Championships",
    "https://www.tfrrs.org/results/95975/2026_ACC_Outdoor_Track__Field_Championships",
  ],
  // (Optional) TFRRS performance-list URLs to also seed from.
  listUrls: [],
  // Only keep these events; everything else on a meet page is ignored.
  keepDistancesM: [5000, 10000],
  genderFilter: "M", // strictly Division I men for the preliminary build
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const abs = (href, base) => { try { return new URL(href, base).href; } catch { return null; } };

let parseHTML = null;
try { ({ parse: parseHTML } = await import("node-html-parser")); }
catch { console.warn("· node-html-parser not installed — run: npm i node-html-parser"); }

async function fetchCached(url) {
  await mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, createHash("sha1").update(url).digest("hex") + ".html");
  try { await stat(file); return await readFile(file, "utf8"); } catch {}
  console.log("  ↓", url);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  await writeFile(file, html);
  await sleep(DELAY_MS);
  return html;
}

function timeToSeconds(t) {
  const m = String(t).trim().match(/(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return (m[1] ? parseInt(m[1], 10) : 0) * 60 + parseFloat(m[2]);
}
function eventMeta(title) {
  const s = String(title).toLowerCase();
  if (/10[,]?000|10k\b/.test(s)) return { type: "TRACK", distanceM: 10000 };
  if (/5[,]?000|5k\b/.test(s)) return { type: "TRACK", distanceM: 5000 };
  if (/8[,]?000|8k\b/.test(s)) return { type: "XC", distanceM: 8000 };
  if (/6[,]?000|6k\b/.test(s)) return { type: "XC", distanceM: 6000 };
  return null;
}

/* Discover meet result-page links from any TFRRS page (list/index/team). */
function discoverMeetLinks(html, baseUrl) {
  const links = new Set();
  if (parseHTML) {
    parseHTML(html).querySelectorAll('a[href*="/results"]').forEach((a) => {
      const u = abs(a.getAttribute("href"), baseUrl);
      if (u && /\/results(\/xc)?\/\d/.test(u)) links.add(u.split("#")[0]);
    });
  } else {
    for (const m of html.matchAll(/href="([^"]*\/results[^"]*)"/gi)) {
      const u = abs(m[1], baseUrl);
      if (u && /\/results(\/xc)?\/\d/.test(u)) links.add(u.split("#")[0]);
    }
  }
  return [...links];
}

/* Parse a meet results page → array of races with finisher rows. */
function parseMeet(html, url) {
  const races = [];
  if (!parseHTML) return races; // meet parsing needs the DOM parser
  const root = parseHTML(html);
  const meetName = (root.querySelector("h3, .title, title")?.text || "Meet").trim().replace(/\s+/g, " ");
  root.querySelectorAll("table").forEach((table) => {
    const heading = (table.previousElementSibling?.text || table.getAttribute("summary") || "").trim();
    const meta = eventMeta(heading) || eventMeta(meetName);
    if (!meta) return;
    const gender = /women|\bw\b|female/i.test(heading) ? "F" : "M";
    const rows = [];
    table.querySelectorAll("tr").forEach((tr) => {
      const tds = tr.querySelectorAll("td");
      if (tds.length < 3) return;
      const link = tr.querySelector('a[href*="/athletes/"]');
      const name = (link?.text || tds[1].text).trim().replace(/\s+/g, " ");
      const team = (tr.querySelector('a[href*="/teams/"]')?.text || "").trim();
      const seconds = timeToSeconds(tds[tds.length - 1].text.trim());
      const athleteUrl = link ? abs(link.getAttribute("href"), url) : null;
      if (name && seconds) rows.push({ name, athleteUrl, team, seconds });
    });
    if (rows.length) races.push({ meetName, heading, meta, gender, rows, url });
  });
  return races;
}

function emit(racesAll) {
  const teams = new Map(), athletes = new Map();
  const RACES = [], RESULTS = [];
  let rid = 1, resId = 1;
  racesAll.forEach((race) => {
    const dm = race.url.match(/(20\d{2})/);
    const date = `${dm ? dm[1] : CONFIG.season}-01-01`;
    const raceId = `r${rid++}`;
    RACES.push({
      id: raceId, meet: race.meetName, type: race.meta.type,
      courseId: slug(race.meetName), courseName: race.meetName, place: "",
      date, weather: 1.0, gender: race.gender, distanceM: race.meta.distanceM, order: RACES.length,
    });
    race.rows.forEach((row) => {
      const teamId = slug(row.team || "unattached");
      if (!teams.has(teamId)) teams.set(teamId, { id: teamId, name: row.team || "Unattached", abbr: (row.team || "UNA").slice(0, 4).toUpperCase(), conference: "" });
      const aId = row.athleteUrl ? "a-" + slug(row.athleteUrl.split("/").filter(Boolean).pop()) : "a-" + slug(row.name);
      if (!athletes.has(aId)) athletes.set(aId, { id: aId, name: row.name, slug: slug(row.name), teamId, gender: race.gender, year: "" });
      RESULTS.push({ id: `res${resId++}`, raceId, athleteId: aId, teamId, gender: race.gender, seconds: Math.round(row.seconds) });
    });
  });
  const TEAMS = [...teams.values()], ATHLETES = [...athletes.values()];
  return { TEAMS, ATHLETES, RACES, RESULTS };
}

async function run(meetUrls) {
  const racesAll = [];
  for (const url of meetUrls) {
    let html; try { html = await fetchCached(url); } catch (e) { console.warn("  ! skip", url, e.message); continue; }
    parseMeet(html, url).forEach((r) => {
      if (CONFIG.keepDistancesM && !CONFIG.keepDistancesM.includes(r.meta.distanceM)) return;
      if (CONFIG.genderFilter && r.gender !== CONFIG.genderFilter) return;
      racesAll.push(r);
    });
  }
  if (!racesAll.length) {
    console.error("\n✗ No matching races parsed. Most likely cause: this host can't reach tfrrs.org");
    console.error("  (look for 'Host not in allowlist' above), or the page layout changed.");
    process.exit(2);
  }
  const { TEAMS, ATHLETES, RACES, RESULTS } = emit(racesAll);
  const out = `/* Harrier — generated from TFRRS by import/tfrrs_import.mjs. Do not edit by hand. */
(function () {
  "use strict";
  const COURSES = ${JSON.stringify(Object.fromEntries(RACES.map((r) => [r.courseId, { name: r.courseName, place: "", factor: 1 }])))};
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
  console.log(`\n✓ ${OUT_FILE}: ${ATHLETES.length} athletes · ${TEAMS.length} teams · ${RACES.length} races · ${RESULTS.length} results`);
  console.log(`  In index.html, swap data.js → real_data.js to go live.`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--crawl") {
    const seeds = args.slice(1);
    if (!seeds.length) { console.error("Usage: --crawl <indexUrl> [...]"); process.exit(1); }
    const meets = new Set();
    for (const seed of seeds) {
      try { discoverMeetLinks(await fetchCached(seed), seed).forEach((u) => meets.add(u)); }
      catch (e) { console.warn("  ! seed failed", seed, e.message); }
    }
    console.log(`· discovered ${meets.size} meets`);
    return run([...meets]);
  }
  // DEFAULT: import the configured meet pages directly, plus any list URLs.
  const meets = new Set(CONFIG.meetUrls);
  for (const listUrl of CONFIG.listUrls) {
    try { discoverMeetLinks(await fetchCached(listUrl), listUrl).forEach((u) => meets.add(u)); }
    catch (e) { console.warn("  ! list failed", listUrl, e.message); }
  }
  console.log(`· importing ${meets.size} meets (events: ${CONFIG.keepDistancesM.join("/")}m, gender: ${CONFIG.genderFilter})`);
  return run([...meets]);
}

main().catch((e) => { console.error(e); process.exit(1); });
