// Generates src/data/programs.json — ~180 fictionalized men's XC programs.
// Deterministic. Edit the curated list / fillers here, or edit the JSON by hand
// afterward (the JSON is the source of truth the game loads).
//
// Fictionalization rules applied:
//  - Flagship single-state powers keep the STATE name (Oregon, Colorado, Arkansas…).
//  - When two programs share a state, use CITY/REGION names (Ann Arbor vs East Lansing).
//  - When a small city *is* the school identity (Syracuse), use a REGION descriptor
//    ("Upstate Uni"). No real school/mascot/logo/athlete/meet names; colors are OK.
import { writeFileSync, mkdirSync } from "node:fs";

function rng(seed) { // mulberry32
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(42);
const pick = (a) => a[Math.floor(R() * a.length)];
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const CONFS = {
  GLC: "Great Lakes Conference", ATL: "Atlantic League", SOA: "Southern Alliance",
  HLC: "Heartland Conference", MWL: "Mountain West League", PCC: "Pacific Coast Conference",
  EMP: "Empire League", GLF: "Gulf Conference", FRO: "Frontier Conference",
  MET: "Metro League", COL: "Colonial Conference",
};

// Curated elite + strong programs (fictionalized). [name,color,region,conf,prestige]
const CURATED = [
  ["Oregon", "#154733", "pacific", "PCC", 97],
  ["Colorado", "#111111", "mountain", "MWL", 96],
  ["Stillwater", "#ff7300", "southcentral", "FRO", 96],
  ["Flagstaff", "#003466", "mountain", "MWL", 96],
  ["Provo", "#0033a0", "mountain", "MWL", 95],
  ["Arkansas", "#9d2235", "southcentral", "SOA", 93],
  ["Wisconsin", "#c5050c", "greatlakes", "GLC", 93],
  ["Palo Alto", "#8c1515", "pacific", "PCC", 92],
  ["Washington", "#4b2e83", "pacific", "PCC", 92],
  ["Upstate Uni", "#f76900", "northeast", "EMP", 92],
  ["Virginia", "#232d4b", "midatlantic", "ATL", 91],
  ["Ann Arbor", "#ffcb05", "greatlakes", "GLC", 90],
  ["South Bend", "#0c2340", "greatlakes", "GLC", 90],
  ["New Rochelle", "#6f263d", "northeast", "MET", 90],
  ["Ames", "#c8102e", "heartland", "HLC", 90],
  ["North Carolina", "#7bafd4", "southeast", "ATL", 88],
  ["Winston-Salem", "#9e7e38", "southeast", "ATL", 87],
  ["Portland", "#4b306a", "pacific", "PCC", 87],
  ["Alabama", "#9e1b32", "southeast", "GLF", 86],
  ["Main Line", "#13294b", "midatlantic", "COL", 86],
  ["Potomac", "#041e42", "midatlantic", "COL", 85],
  ["Pullman", "#981e32", "pacific", "PCC", 85],
  ["Texas", "#bf5700", "southcentral", "FRO", 84],
  ["Florida", "#0021a5", "southeast", "GLF", 84],
  ["Tennessee", "#ff8200", "southeast", "SOA", 84],
  ["Derby City", "#ad0000", "southeast", "ATL", 84],
  ["Minnesota", "#7a0019", "heartland", "HLC", 83],
  ["Boise", "#0033a0", "mountain", "FRO", 82],
  ["Ithaca", "#b31b1b", "northeast", "EMP", 82],
  ["Nassau", "#ff671f", "northeast", "COL", 82],
  ["Columbus", "#bb0000", "greatlakes", "GLC", 82],
  ["Corvallis", "#dc4405", "pacific", "PCC", 82],
  ["East Lansing", "#18453b", "greatlakes", "GLC", 82],
  ["Kansas", "#0051ba", "heartland", "HLC", 81],
  ["Iowa City", "#000000", "heartland", "HLC", 81],
  ["Raleigh", "#cc0000", "southeast", "ATL", 81],
  ["Cambridge", "#a51c30", "northeast", "COL", 80],
  ["West Lafayette", "#b1810b", "greatlakes", "GLC", 80],
  ["Utah", "#cc0000", "mountain", "MWL", 80],
  ["Georgia", "#ba0c2f", "southeast", "GLF", 80],
  ["Greenville", "#582c83", "southeast", "SOA", 79],
  ["Westwood", "#2d68c4", "pacific", "PCC", 79],
  ["Berkeley", "#003262", "pacific", "PCC", 79],
  ["Bloomington", "#990000", "greatlakes", "GLC", 78],
  ["Morningside", "#9bddff", "northeast", "EMP", 78],
  ["Green Country", "#002d72", "southcentral", "FRO", 78],
  ["Bluegrass", "#7b1e3b", "southeast", "SOA", 77],
  ["Spokane", "#041e42", "pacific", "PCC", 77],
  ["Atlanta", "#b3a369", "southeast", "GLF", 76],
  ["Oxford", "#13294b", "southeast", "GLF", 75],
  ["Lubbock", "#cc0000", "southcentral", "FRO", 75],
  ["College Station", "#500000", "southcentral", "SOA", 75],
  ["Mid-Missouri", "#f1b82d", "heartland", "HLC", 74],
  ["Durham", "#003087", "southeast", "ATL", 74],
  ["Logan", "#00263a", "mountain", "MWL", 73],
];

// Filler city/region names per region for lower-prestige teams.
const FILLER = {
  northeast: ["Hartford","Providence","Burlington","Portland ME","Worcester","Albany","Buffalo","Scranton","New Haven","Manchester","Bangor","Lowell","Springfield MA","Rochester","Binghamton","Stony Brook","Hoboken","Fairfield"],
  midatlantic: ["Trenton","Baltimore","Richmond","Wilmington","Harrisburg","Newark","Annapolis","Allentown","Camden","Dover","Chesapeake","Fairfax","Morgantown","Towson","Hampton Roads","Bethlehem"],
  southeast: ["Charleston","Savannah","Knoxville","Columbia SC","Chattanooga","Mobile","Augusta","Macon","Asheville","Wilmington NC","Birmingham","Gainesville","Tallahassee","Boone","Clemson Hills","Murfreesboro","Hattiesburg","Johnson City"],
  greatlakes: ["Toledo","Grand Rapids","Dayton","Akron","Fort Wayne","Rockford","Green Bay","Kalamazoo","Peoria","South Shore","Cleveland","Cincinnati","Ypsilanti","Oxford OH","Terre Haute","Milwaukee","Evansville","Normal"],
  heartland: ["Omaha","Wichita","Des Moines","Sioux Falls","Cedar Rapids","Springfield MO","Fargo","Topeka","Lincoln","Duluth","Grand Forks","Brookings","Vermillion","Manhattan KS","Columbia MO North","Rolla"],
  southcentral: ["Fayetteville","Shreveport","Little Rock","Tulsa Hills","Amarillo","Waco","San Antonio","El Paso","Wichita Falls","Denton","Baton Rouge","Lafayette","Conway","Edmond","Commerce","Huntsville TX"],
  mountain: ["Bozeman","Missoula","Cheyenne","Grand Junction","Pocatello","Ogden","Durango","Rexburg","Laramie","Flagstaff North","Billings","Helena","Boulder Creek","Moscow ID","Cedar City","Gunnison"],
  west: ["Reno","Tucson","Albuquerque","Las Vegas","Santa Fe","Mesa","Tempe","Boulder Flats","Carson City","Prescott","Flagstaff West","Las Cruces","Henderson","Yuma","San Marcos CA","Fullerton","Riverside","Long Beach"],
  pacific: ["Eugene Valley","Sacramento","Fresno","Santa Barbara","San Luis Obispo","Tacoma","Salem","Chico","Humboldt","Davis","Stockton","Monterey","Bellingham","Ellensburg","San Jose","Pomona","Northridge","Irvine"],
};
const REGION_CONFS = {
  northeast: ["EMP", "COL", "MET"], midatlantic: ["ATL", "COL", "MET"],
  southeast: ["SOA", "GLF", "ATL"], greatlakes: ["GLC", "MET"],
  heartland: ["HLC", "FRO"], southcentral: ["FRO", "SOA"],
  mountain: ["MWL", "FRO"], west: ["MWL", "PCC", "FRO"], pacific: ["PCC", "MWL"],
};
const PALETTE = ["#1f6feb","#d2691e","#2e7d32","#6a1b9a","#c62828","#00695c","#455a64","#ad1457","#4e342e","#f9a825","#283593","#00838f"];

const programs = [];
const used = new Set();
for (const [name, color, region, conf, prestige] of CURATED) {
  programs.push({ id: slug(name), name, colorPrimary: color, region, conference: conf, prestige, isTop50: false });
  used.add(name);
}
// Fill to ~180 with lower-prestige teams, spread across each region's conferences.
const TARGET = 180;
let guard = 0;
while (programs.length < TARGET && guard++ < 1000) {
  for (const region of Object.keys(FILLER)) {
    if (programs.length >= TARGET) break;
    const pool = FILLER[region].filter((n) => !used.has(n));
    if (!pool.length) continue;
    const name = pick(pool);
    used.add(name);
    const conf = pick(REGION_CONFS[region]);
    programs.push({
      id: slug(name), name, colorPrimary: pick(PALETTE),
      region, conference: conf,
      prestige: 40 + Math.floor(R() * 29), isTop50: false,
    });
  }
}
// Mark the top 50 by prestige.
[...programs].sort((a, b) => b.prestige - a.prestige).slice(0, 50).forEach((p) => (p.isTop50 = true));

const out = {
  conferences: CONFS,
  regions: ["northeast","midatlantic","southeast","greatlakes","heartland","southcentral","mountain","west","pacific"],
  programs,
};
mkdirSync("src/data", { recursive: true });
writeFileSync("src/data/programs.json", JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${programs.length} programs across ${Object.keys(CONFS).length} conferences.`);
