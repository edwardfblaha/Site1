/* Harrier — data builder
 *
 * Turns the human-entered meet blocks in results-data.js into the normalized
 * shape the engine consumes (COURSES / TEAMS / ATHLETES / RACES / RESULTS).
 *
 * Responsibilities:
 *   - parse "Name|YEAR|Team|Time" rows; drop DNF/DNS/DQ from ranking but the
 *     athlete still exists.
 *   - match athletes across events & meets by normalized name so a runner who
 *     races the 5k and 10k (and at multiple meets) becomes ONE athlete with a
 *     connected head-to-head record.
 *   - mark athletes inactive (not returning) from window.INACTIVE and rosters.
 *   - attach a per-race field-strength weight input (the engine finalizes it).
 */
(function () {
  "use strict";

  const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const normName = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  const ABBR = {}; // team abbreviations are derived if not provided

  function timeToSeconds(t) {
    t = String(t).trim();
    if (/^(dnf|dns|dq|nt|scr)$/i.test(t)) return null;
    const m = t.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
    if (!m) return null;
    return (m[1] ? parseInt(m[1], 10) : 0) * 60 + parseFloat(m[2]);
  }
  function teamAbbr(name) {
    if (ABBR[name]) return ABBR[name];
    const words = name.replace(/[.&]/g, "").split(/\s+/);
    const a = words.length === 1 ? name.slice(0, 4) : words.map((w) => w[0]).join("").slice(0, 4);
    return a.toUpperCase();
  }

  const MEETS = window.MEETS || [];
  const INACTIVE = new Set((window.INACTIVE || []).map(normName));
  const ROSTERS = window.ROSTERS || {};
  const rosterByTeam = {};
  Object.keys(ROSTERS).forEach((team) => { rosterByTeam[team] = new Set(ROSTERS[team].map(normName)); });

  const teams = new Map();
  const athletes = new Map();   // key: normName -> athlete object
  const RACES = [];
  const RESULTS = [];
  let rid = 1, resId = 1, order = 0;

  // Meets are processed oldest→newest so race "order" supports recency weighting.
  const sortedMeets = [...MEETS].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  sortedMeets.forEach((meet) => {
    (meet.events || []).forEach((ev) => {
      const raceId = `r${rid++}`;
      const distanceM = ev.distanceM;
      const race = {
        id: raceId,
        meet: meet.name,
        meetId: meet.id,
        type: ev.type || "TRACK",
        tier: meet.tier || "",
        courseId: slug(meet.id || meet.name),
        courseName: meet.name,
        place: meet.place || "",
        date: meet.date || "",
        gender: ev.gender,
        distanceM,
        order: order++,
        // fieldStrength is filled in by the engine after ratings exist; the
        // builder leaves a neutral default so the data is self-contained.
        fieldStrength: 1,
      };
      RACES.push(race);

      (ev.results || []).forEach((line) => {
        const [name, year, team, timeStr] = String(line).split("|").map((s) => s.trim());
        if (!name) return;
        const key = normName(name);
        const teamName = team || "Unattached";
        const teamId = slug(teamName);
        if (!teams.has(teamId)) teams.set(teamId, { id: teamId, name: teamName, abbr: teamAbbr(teamName), conference: "" });

        let a = athletes.get(key);
        if (!a) {
          a = {
            id: "a-" + key.replace(/ /g, "-"),
            name, slug: slug(name),
            teamId, gender: ev.gender, year: year || "",
            active: true,
          };
          athletes.set(key, a);
        } else if (year && !a.year) {
          a.year = year;
        }

        const seconds = timeToSeconds(timeStr);
        // Non-finishers: keep the athlete, but no rankable result row.
        if (seconds == null) return;
        RESULTS.push({
          id: `res${resId++}`, raceId, athleteId: a.id, teamId,
          gender: ev.gender, seconds: Math.round(seconds * 100) / 100,
        });
      });
    });
  });

  // ---- Activity status (returning vs. not) ----
  // An athlete is inactive if explicitly listed, OR if their team has an
  // official 2026 roster and they're not on it.
  athletes.forEach((a, key) => {
    let active = true;
    if (INACTIVE.has(key)) active = false;
    const teamName = teams.get(a.teamId) ? teams.get(a.teamId).name : null;
    if (teamName && rosterByTeam[teamName] && !rosterByTeam[teamName].has(key)) active = false;
    a.active = active;
  });

  const ATHLETES = [...athletes.values()];
  const TEAMS = [...teams.values()];

  window.DATA = {
    COURSES: Object.fromEntries(RACES.map((r) => [r.courseId, { name: r.courseName, place: r.place, factor: 1 }])),
    TEAMS, teamById: Object.fromEntries(TEAMS.map((t) => [t.id, t])),
    ATHLETES, athleteById: Object.fromEntries(ATHLETES.map((a) => [a.id, a])),
    RACES, raceById: Object.fromEntries(RACES.map((r) => [r.id, r])),
    RESULTS,
  };
})();
