/* Harrier — real results (hand-entered from official result pages).
 *
 * 2026 NCAA Division I CROSS COUNTRY season — fresh start.
 *
 * HOW TO ADD A MEET: copy the template block below, fill in the header, and
 * paste each finisher as a single line:  "Name|YEAR|Team|Time"
 *   - YEAR : class as shown, e.g. "JR", "FR-1", "SR-4", or "" if unknown
 *   - Time : cross country time "24:31.7" / "23:40"; use "DNF"/"DNS"/"DQ"
 *            for non-finishers (kept for the record but not ranked).
 * Men's XC is usually 8,000m and women's 6,000m, but set distanceM per meet.
 * Athletes are matched across meets by name, so a runner who races several
 * meets is linked into one head-to-head record — that's what builds the
 * national ranking.
 *
 * `tier` optionally nudges meet importance ("national" > "regional" >
 * "conference"); the engine ALSO weights each race by the strength of the
 * field that showed up, so leave it off if unsure.
 */
window.MEETS = [
  // ── TEMPLATE — copy this block per meet, then fill in and uncomment ──
  // {
  //   id: "nuttycombe-2026",
  //   name: "Nuttycombe Invitational",
  //   date: "2026-10-16",
  //   place: "Madison, WI",
  //   tier: "",              // "national" | "regional" | "conference" | ""
  //   events: [
  //     {
  //       gender: "M", type: "XC", distanceM: 8000,
  //       results: [
  //         "First Last|JR|Team Name|23:40.1",
  //         "First Last|SO|Team Name|23:45.6",
  //         // …every finisher, in order…
  //       ],
  //     },
  //     // add a women's 6,000m event block the same way when you have it
  //   ],
  // },
];

/* Athletes confirmed NOT returning (graduated / pro / transferred out).
 * Names here are marked INACTIVE: kept as head-to-head evidence but excluded
 * from the active national rankings. */
window.INACTIVE = [
  // "Some Senior",
];

/* Optional: official 2026 program rosters, keyed by team name. When a team has
 * a roster here, only rostered athletes are treated as active for that team. */
window.ROSTERS = {
  // "Northern Arizona": ["Athlete One", "Athlete Two", ...],
};

/* Previous completed season's FINAL ratings, used as a 25% prior once
 * available. Keyed by athlete id ("a-" + lowercased-hyphenated name, e.g.
 * "a-habtom-samuel"). Dormant until populated. */
window.PREV_SEASON = { scores: {} };
