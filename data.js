/* Harrier — seed dataset (illustrative demo data, NOT official results)
 *
 * Shape mirrors what a TFRRS ingest would produce: athletes, teams, and
 * races (cross country 8k/6k AND track 5000m/10000m), each race with a list
 * of finishers and times. The ranking engine derives everything from the
 * head-to-head finishing order in these races.
 *
 * Real data path: a TFRRS importer (see README) populates these same arrays
 * from tfrrs.org meet result pages. The demo set is generated deterministically
 * so every page is explorable today.
 */
(function () {
  "use strict";

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(20260616);
  const gauss = (mean, sd) => {
    const u = Math.max(1e-9, rand()), v = rand();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  // Course difficulty only shapes the demo *times*; the engine never sees it —
  // rankings come purely from finishing order (head-to-head).
  const COURSES = {
    nuttycombe: { name: "Nuttycombe Invitational", place: "Madison, WI", factor: 0.992 },
    "joe-piane": { name: "Joe Piane Invitational", place: "Notre Dame, IN", factor: 1.004 },
    "pre-nats": { name: "Pre-Nationals", place: "Stillwater, OK", factor: 1.021 },
    "conf-champs": { name: "Conference Championships", place: "various", factor: 1.028 },
    panorama: { name: "NCAA Regionals — Panorama Farms", place: "Charlottesville, VA", factor: 1.012 },
    nationals: { name: "NCAA Championships", place: "Madison, WI", factor: 1.000 },
    "track-armory": { name: "Boston University Last Chance", place: "Boston, MA", factor: 1.0 },
    "track-payton": { name: "Payton Jordan Invitational", place: "Stanford, CA", factor: 1.0 },
  };

  const TEAM_DEFS = [
    ["Northern Arizona", "NAU", "Big Sky", 1.00],
    ["Oklahoma State", "OSU", "Big 12", 0.99],
    ["BYU", "BYU", "Big 12", 0.99],
    ["Stanford", "STAN", "ACC", 0.985],
    ["Syracuse", "CUSE", "ACC", 0.97],
    ["Notre Dame", "ND", "ACC", 0.985],
    ["Oregon", "ORE", "Big Ten", 0.99],
    ["Wisconsin", "WIS", "Big Ten", 0.98],
    ["Washington", "UW", "Big Ten", 0.985],
    ["Colorado", "CU", "Big 12", 0.985],
    ["NC State", "NCST", "ACC", 0.98],
    ["Iowa State", "ISU", "Big 12", 0.98],
  ];

  const FIRST_M = ["Liam","Noah","Ethan","Caleb","Owen","Aiden","Gabriel","Isaac","Mason","Logan","Wyatt","Elijah","Henry","Carter","Jack","Hudson","Leo","Micah","Silas","Cole","Brooks","Finn","Roman","Asher"];
  const FIRST_F = ["Emma","Olivia","Ava","Sophia","Isabella","Mia","Amelia","Harper","Ella","Grace","Chloe","Lily","Nora","Hazel","Zoe","Aria","Maya","Ruby","Iris","Clara","June","Stella","Elena","Sadie"];
  const LAST = ["Carlson","Whitaker","Nguyen","Okafor","Mbatha","Sorensen","Delgado","Romero","Fitzgerald","Hollis","Bennington","Beckett","Conroy","Devereux","Espinoza","Falk","Goswick","Hartley","Iversen","Jamison","Kessler","Larkin","Mercer","Novak","Ott","Pruitt","Quinto","Rasmussen","Steed","Thornbury","Underwood","Voss","Welsh","Yates","Zimmer","Baptiste","Crowell","Donovan"];

  const TEAMS = [];
  const ATHLETES = [];
  let aid = 1;
  const YEARS = ["FR", "SO", "JR", "SR", "5Y"];

  TEAM_DEFS.forEach(([name, abbr, conf, strength]) => {
    const team = { id: slug(name), name, abbr, conference: conf };
    TEAMS.push(team);
    ["M", "F"].forEach((gender) => {
      const baseMean = gender === "M" ? 1476 : 1296; // 8k / 6k flat reference
      const teamShift = (strength - 1.0) * 1400;
      const n = 9 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        const depthPenalty = i * (gender === "M" ? 7.5 : 7.0);
        const base = Math.max(
          gender === "M" ? 1338 : 1158,
          gauss(baseMean + teamShift + depthPenalty, 18)
        );
        const first = gender === "M" ? pick(FIRST_M) : pick(FIRST_F);
        const fullName = `${first} ${pick(LAST)}`;
        ATHLETES.push({
          id: `a${aid++}`, name: fullName, slug: slug(fullName) + "-" + aid,
          teamId: team.id, gender, year: pick(YEARS),
          base, improve: Math.abs(gauss(gender === "M" ? 11 : 10, 5)),
          consistency: 0.004 + rand() * 0.006,
        });
      }
    });
  });

  const athleteById = Object.fromEntries(ATHLETES.map((a) => [a.id, a]));

  // ---- Schedule: cross country meets + track 5k/10k races ----
  const SCHEDULE = [
    { courseId: "nuttycombe", date: "2025-09-26", weather: 1.004, label: "Nuttycombe Invitational", type: "XC" },
    { courseId: "joe-piane", date: "2025-10-03", weather: 1.010, label: "Joe Piane Invitational", type: "XC" },
    { courseId: "pre-nats", date: "2025-10-18", weather: 1.006, label: "Pre-Nationals", type: "XC" },
    { courseId: "conf-champs", date: "2025-11-01", weather: 1.018, label: "Conference Championships", type: "XC" },
    { courseId: "panorama", date: "2025-11-14", weather: 1.012, label: "NCAA Regionals", type: "XC" },
    { courseId: "nationals", date: "2025-11-22", weather: 1.002, label: "NCAA Championships", type: "XC" },
    // Track races used as additional head-to-head evidence (5k / 10k).
    { courseId: "track-payton", date: "2025-05-02", weather: 1.0, label: "Payton Jordan Invite", type: "TRACK", trackDist: 10000 },
    { courseId: "track-armory", date: "2025-12-06", weather: 1.0, label: "BU Last Chance", type: "TRACK", trackDist: 5000 },
  ];

  // Convert an athlete's 8k/6k flat reference to a track time (no fake-slow
  // conversion: distance-scale with Riegel, gently tuned per gender).
  function trackTime(a, distM, progress) {
    const fromDist = a.gender === "M" ? 8000 : 6000;
    const improved = a.base - a.improve * progress;
    let t = improved * Math.pow(distM / fromDist, 1.06);
    t *= a.gender === "M" ? 0.957 : 0.94; // honest-effort credit
    return t;
  }

  const RACES = [];
  const RESULTS = [];
  let rid = 1;
  const ordered = [...SCHEDULE].sort((a, b) => a.date.localeCompare(b.date));

  ordered.forEach((meet, mi) => {
    const course = COURSES[meet.courseId];
    ["M", "F"].forEach((gender) => {
      const distanceM = meet.type === "TRACK" ? meet.trackDist : gender === "M" ? 8000 : 6000;
      const race = {
        id: `r${rid++}`, meet: meet.label, type: meet.type,
        courseId: meet.courseId, courseName: course.name, place: course.place,
        date: meet.date, weather: meet.weather, gender, distanceM, order: mi,
      };
      RACES.push(race);

      // Track 10k draws a smaller, self-selected field; XC nearly everyone.
      const skip = meet.type === "TRACK" ? (meet.trackDist === 10000 ? 0.5 : 0.32) : 0.12;
      const field = ATHLETES.filter((a) => a.gender === gender).filter(() => rand() > skip);
      const progress = mi / (ordered.length - 1);

      field.forEach((a) => {
        let raw;
        if (meet.type === "TRACK") {
          raw = trackTime(a, distanceM, progress) * (1 + gauss(0, a.consistency));
        } else {
          const improved = a.base - a.improve * progress;
          raw = improved * course.factor * meet.weather * (1 + gauss(0, a.consistency));
        }
        RESULTS.push({
          id: `res${RESULTS.length + 1}`, raceId: race.id,
          athleteId: a.id, teamId: a.teamId, gender, seconds: Math.round(raw),
        });
      });
    });
  });

  window.DATA = {
    COURSES,
    TEAMS, teamById: Object.fromEntries(TEAMS.map((t) => [t.id, t])),
    ATHLETES, athleteById,
    RACES, raceById: Object.fromEntries(RACES.map((r) => [r.id, r])),
    RESULTS,
  };
})();
