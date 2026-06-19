/* Harrier — head-to-head rating engine
 *
 * National rankings are derived purely from who-beat-whom across every race an
 * athlete runs: all cross country races PLUS track 5000m / 10000m. We never
 * convert XC to a "5k time" to rank — finishing order is the evidence.
 *
 * Method (per gender):
 *   1. Build the head-to-head graph: for each race, every finisher beats
 *      everyone behind them. Accumulate wins/losses per ordered pair, with a
 *      recency weight (later-season races count more).
 *   2. Solve a Massey-style linear rating where rating[i] - rating[j] explains
 *      the margin of head-to-head dominance between i and j, regularized so
 *      lightly-connected athletes pull toward the mean.
 *   3. Scale ratings to a friendly 0–100 Harrier Score for display.
 *
 * This is a connected, transitive ranking: beating someone who beats strong
 * runners lifts you even if you never met the top names directly.
 */
(function () {
  "use strict";
  const D = window.DATA;
  // Previous completed season's final ratings, by athlete id → 0–100 score.
  // Populated from window.PREV_SEASON when a prior season has been loaded.
  // When present it contributes 25% to an athlete's current season rating.
  const PREV = (window.PREV_SEASON && window.PREV_SEASON.scores) || {};
  const PREV_WEIGHT = 0.25;

  function recencyWeight(order, maxOrder) {
    return 1 + (order / Math.max(1, maxOrder)) * 1.2; // 1.0 → 2.2 across season
  }

  // Optional manual importance nudge on top of computed field strength.
  function tierMultiplier(tier) {
    switch (tier) {
      case "national": return 1.25;
      case "regional": return 1.12;
      case "conference": return 1.05;
      default: return 1;
    }
  }

  function buildGender(gender, fieldStrengthByRace) {
    fieldStrengthByRace = fieldStrengthByRace || {};
    const athletes = D.ATHLETES.filter((a) => a.gender === gender);
    const idx = Object.fromEntries(athletes.map((a, i) => [a.id, i]));
    const n = athletes.length;
    const maxOrder = Math.max(...D.RACES.map((r) => r.order), 1);

    // Pairwise tallies and aggregate matchup matrix for Massey.
    const beat = {};      // beat[a][b] = weighted count a finished ahead of b
    const meetings = {};  // meetings[a][b] = raw count of races a & b both ran
    const W = new Float64Array(n);          // RAW wins (true count finished ahead)
    const L = new Float64Array(n);          // RAW losses (true count finished behind)
    const M = [];                            // Massey normal matrix
    const b = new Float64Array(n);
    for (let i = 0; i < n; i++) M.push(new Float64Array(n));

    const races = D.RACES.filter((r) => r.gender === gender);
    let totalComparisons = 0;

    races.forEach((race) => {
      const rows = D.RESULTS.filter((x) => x.raceId === race.id)
        .filter((x) => idx[x.athleteId] !== undefined)
        .sort((p, q) => p.seconds - q.seconds);
      // Race weight = recency × field strength (quality of who showed up) ×
      // an optional manual tier multiplier. Beating a strong field counts more.
      const fs = fieldStrengthByRace[race.id] != null ? fieldStrengthByRace[race.id] : 1;
      const w = recencyWeight(race.order, maxOrder) * fs * tierMultiplier(race.tier);

      for (let p = 0; p < rows.length; p++) {
        for (let q = p + 1; q < rows.length; q++) {
          const winner = rows[p], loser = rows[q];
          const wi = idx[winner.athleteId], li = idx[loser.athleteId];
          // A win is mostly a win: every head-to-head result carries a strong
          // baseline, with margin only a modest bonus. This is deliberate for
          // distance racing — a one-second win over the #1 contender is at
          // least as meaningful as a 30s win over the back of the field, so we
          // must NOT let big late-race gaps outweigh tight elite finishes.
          const gap = (loser.seconds - winner.seconds) / winner.seconds; // fractional
          const margin = Math.max(0.8, Math.min(1.2, 0.85 + gap * 10));
          const wgt = w * margin;

          // RAW record = true count of athletes finished ahead of / behind.
          W[wi] += 1; L[li] += 1;
          (beat[winner.athleteId] ||= {});
          beat[winner.athleteId][loser.athleteId] = (beat[winner.athleteId][loser.athleteId] || 0) + 1;
          (meetings[winner.athleteId] ||= {});
          meetings[winner.athleteId][loser.athleteId] = (meetings[winner.athleteId][loser.athleteId] || 0) + 1;
          (meetings[loser.athleteId] ||= {});
          meetings[loser.athleteId][winner.athleteId] = (meetings[loser.athleteId][winner.athleteId] || 0) + 1;

          // Massey: each comparison is an equation rating[wi]-rating[li] = +margin
          M[wi][wi] += wgt; M[li][li] += wgt;
          M[wi][li] -= wgt; M[li][wi] -= wgt;
          b[wi] += wgt; b[li] -= wgt;
          totalComparisons++;
        }
      }
    });

    // Regularize toward mean (ridge) so isolated athletes stay near 0, and the
    // system is solvable even where the graph is sparse.
    const lambda = 0.8;
    for (let i = 0; i < n; i++) M[i][i] += lambda;

    const rating = solve(M, b, n);

    // Map raw ratings → 0–100 using robust anchors so the elite end stays
    // well-separated even when a long tail of slower athletes widens the field.
    // Anchor the top rating near 99 and the 5th percentile near 40, scaling
    // linearly between — this keeps #1 vs #5 visibly distinct.
    const sorted = [...rating].filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    const q = (p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))] : 0;
    const hi = q(0.999), lo = q(0.05);
    const span = (hi - lo) || 1;
    const scoreOf = (r) => Math.max(1, Math.min(100, 40 + ((r - lo) / span) * 59));

    // ---- Per-race performance scores ----
    // The global Massey rating above values every opponent. We now grade each
    // individual RACE an athlete ran by who they beat and lost to in it, then
    // aggregate those per-race grades into a season score that (a) drops the
    // athlete's single worst race and (b) weights their best race the most, so
    // a genuinely higher absolute ceiling shows through.
    const globalScoreByIdx = (j) => scoreOf(rating[j]);
    function racePerformance(athleteId, raceId) {
      const rows = D.RESULTS.filter((x) => x.raceId === raceId)
        .filter((x) => idx[x.athleteId] !== undefined)
        .sort((p, q) => p.seconds - q.seconds);
      const myPlace = rows.findIndex((x) => x.athleteId === athleteId);
      if (myPlace < 0 || rows.length < 2) return null;
      // Performance = how you placed within the field, scaled by the field's
      // strength. Beating strong runners near the front scores high; the same
      // place in a weak race scores lower. Maps to the same 0–100 space.
      const beatBelow = rows.slice(myPlace + 1).map((x) => globalScoreByIdx(idx[x.athleteId]));
      const lostAbove = rows.slice(0, myPlace).map((x) => globalScoreByIdx(idx[x.athleteId]));
      const fieldScores = rows.map((x) => globalScoreByIdx(idx[x.athleteId]));
      const fieldMax = Math.max(...fieldScores);
      const fieldMean = fieldScores.reduce((s, v) => s + v, 0) / fieldScores.length;
      // Anchor near the strongest you beat, lifted toward the field's ceiling.
      const beatTop = beatBelow.length ? Math.max(...beatBelow) : fieldMean - 6;
      const lostMin = lostAbove.length ? Math.min(...lostAbove) : fieldMax + 2;
      // Sit between the best runner you beat and the worst who beat you, with a
      // bonus for racing (and surviving) a strong field overall.
      const between = (beatTop + lostMin) / 2;
      return Math.max(1, Math.min(100, 0.7 * between + 0.3 * fieldMax));
    }

    // Aggregate per-race performances into a season score:
    //  - drop the single worst race (when the athlete has ≥3),
    //  - weight the remaining races geometrically (best ×1, next ×0.6, …) so
    //    the best race dominates and a higher true ceiling is rewarded.
    function seasonScore(athleteId) {
      const raceIds = [...new Set(D.RESULTS.filter((x) => x.athleteId === athleteId).map((x) => x.raceId))];
      let perfs = raceIds.map((rid) => racePerformance(athleteId, rid)).filter((v) => v != null);
      if (!perfs.length) return null;
      perfs.sort((a, b) => b - a); // best first
      if (perfs.length >= 3) perfs = perfs.slice(0, perfs.length - 1); // drop worst
      const DECAY = 0.6; // best race weighted most
      let num = 0, den = 0, wt = 1;
      for (const p of perfs) { num += p * wt; den += wt; wt *= DECAY; }
      return num / den;
    }

    // Assemble per-athlete records.
    const recs = athletes.map((a) => {
      const wins = W[idx[a.id]], losses = L[idx[a.id]];
      const raw = rating[idx[a.id]];
      const races = [...new Set(D.RESULTS.filter((x) => x.athleteId === a.id).map((x) => x.raceId))];
      const seasonRaw = seasonScore(a.id);
      // Best single race = the athlete's ceiling, shown on the profile.
      const perfList = races.map((rid) => racePerformance(a.id, rid)).filter((v) => v != null);
      const bestRace = perfList.length ? Math.max(...perfList) : null;
      // Blend in last completed season at 25% when available.
      const prev = PREV[a.id];
      const season = seasonRaw == null ? scoreOf(raw) : seasonRaw;
      const score = prev != null ? (1 - PREV_WEIGHT) * season + PREV_WEIGHT * prev : season;
      return {
        athlete: a, team: D.teamById[a.teamId],
        raw, score,
        seasonScore: seasonRaw,
        bestRace,
        prevSeason: prev != null ? prev : null,
        wins: Math.round(wins), losses: Math.round(losses),
        winPct: wins + losses > 0 ? wins / (wins + losses) : 0,
        raceCount: races.length,
        active: a.active !== false,
        _idx: idx[a.id],
      };
    });

    // Strength of schedule: the average rating of every opponent actually
    // raced (from real head-to-head meetings). This makes "lost to 22 great
    // runners" visible and is what lets such an athlete rate above someone who
    // beat a weak field — the rating already reflects it, this surfaces it.
    const scoreByIdx = (j) => scoreOf(rating[j]);
    recs.forEach((rec) => {
      const opps = meetings[rec.athlete.id] || {};
      let sum = 0, cnt = 0, best = -Infinity;
      Object.keys(opps).forEach((oid) => {
        if (idx[oid] === undefined) return;
        const c = opps[oid]; // times they met
        const os = scoreByIdx(idx[oid]);
        sum += os * c; cnt += c;
        if (os > best) best = os;
      });
      rec.sos = cnt ? sum / cnt : 0;            // avg opponent quality
      rec.bestOpponent = best === -Infinity ? 0 : best;
      rec.opponents = cnt;                       // total head-to-head meetings
    });

    // National rank within gender by rating. Only rank athletes with actual
    // head-to-head evidence: someone who never finished a race against anyone
    // (e.g. DNF/DNS only) has no comparisons, so the regularizer parks them at
    // the field mean — they must NOT sit above athletes with real records.
    // Inactive (not returning) athletes are also excluded from the ranking.
    const ranked = recs.filter((r) => r.active && r.opponents > 0).sort((x, y) => y.score - x.score);
    ranked.forEach((r, i) => {
      r.rank = i + 1;
      r.percentile = 100 * (1 - i / Math.max(1, ranked.length - 1));
      r.fieldSize = ranked.length;
    });
    // Unranked = active but no head-to-head evidence yet.
    recs.filter((r) => r.active && r.opponents === 0).forEach((r) => {
      r.rank = null; r.unranked = true; r.fieldSize = ranked.length;
    });
    recs.filter((r) => !r.active).forEach((r) => { r.rank = null; r.fieldSize = ranked.length; });
    recs.sort((x, y) => y.score - x.score);

    return { athletes, recs, ranked,
      recById: Object.fromEntries(recs.map((r) => [r.athlete.id, r])),
      beat, meetings, scoreOf, maxOrder };
  }

  // Field strength of each race = how strong its competitors are, from a prior
  // set of athlete scores. Normalized so an average field ≈ 1.0; elite fields
  // weigh more. Returns { raceId: strength }.
  function computeFieldStrength(recById) {
    const byRace = {};
    D.RACES.forEach((race) => {
      const rows = D.RESULTS.filter((x) => x.raceId === race.id);
      if (!rows.length) { byRace[race.id] = 1; return; }
      // Reward both depth and top-end quality: blend mean and top-5 mean score.
      const scores = rows.map((x) => (recById[x.athleteId] ? recById[x.athleteId].score : 50))
        .sort((a, b) => b - a);
      const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
      const topK = scores.slice(0, 5);
      const topMean = topK.reduce((s, v) => s + v, 0) / topK.length;
      byRace[race.id] = 0.5 * mean + 0.5 * topMean; // ~0..100 scale for now
    });
    // Normalize so the average race = 1.0, then compress so weights stay sane.
    const vals = Object.values(byRace);
    const avg = vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length);
    Object.keys(byRace).forEach((id) => {
      const ratio = byRace[id] / (avg || 1);
      // Compress around 1 so a very strong field is ~1.6x, a weak one ~0.6x.
      byRace[id] = Math.max(0.5, Math.min(1.8, 1 + (ratio - 1) * 1.4));
    });
    return byRace;
  }

  // Solve M x = b via Gaussian elimination with partial pivoting.
  function solve(M, b, n) {
    const A = M.map((row, i) => {
      const r = new Float64Array(n + 1);
      for (let j = 0; j < n; j++) r[j] = row[j];
      r[n] = b[i];
      return r;
    });
    for (let col = 0; col < n; col++) {
      let piv = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
      if (Math.abs(A[piv][col]) < 1e-12) continue;
      [A[col], A[piv]] = [A[piv], A[col]];
      const d = A[col][col];
      for (let j = col; j <= n; j++) A[col][j] /= d;
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const f = A[r][col];
        if (!f) continue;
        for (let j = col; j <= n; j++) A[r][j] -= f * A[col][j];
      }
    }
    const x = new Float64Array(n);
    for (let i = 0; i < n; i++) x[i] = A[i][n];
    return x;
  }

  function build() {
    // Iterate: rate athletes with current field weights, recompute each race's
    // field strength from those ratings, then re-rate. Converges quickly and
    // makes "who you beat" matter more when the field was strong.
    let fsM = {}, fsF = {};
    let M = buildGender("M", fsM);
    let F = buildGender("F", fsF);
    for (let pass = 0; pass < 4; pass++) {
      const recById0 = { ...M.recById, ...F.recById };
      const fs = computeFieldStrength(recById0);
      fsM = fs; fsF = fs;
      M = buildGender("M", fsM);
      F = buildGender("F", fsF);
    }
    // Stash final field strength on each race for display.
    const finalFS = computeFieldStrength({ ...M.recById, ...F.recById });
    D.RACES.forEach((r) => (r.fieldStrength = finalFS[r.id] != null ? finalFS[r.id] : 1));

    const byGender = { M, F };
    const recById = { ...M.recById, ...F.recById };
    const allRecs = [...M.recs, ...F.recs];

    // Head-to-head record between two specific athletes (same gender).
    function h2h(idA, idB) {
      const g = D.athleteById[idA].gender;
      const G = byGender[g];
      const aw = (G.beat[idA] && G.beat[idA][idB]) || 0;
      const bw = (G.beat[idB] && G.beat[idB][idA]) || 0;
      return { aWins: Math.round(aw), bWins: Math.round(bw) };
    }

    // Notable results: biggest wins (beat a higher-ranked athlete) and losses.
    function notables(id) {
      const g = D.athleteById[id].gender;
      const G = byGender[g];
      const meRank = G.recById[id].rank;
      const wins = [], losses = [];
      Object.keys(G.beat[id] || {}).forEach((oppId) => {
        const opp = G.recById[oppId];
        if (opp) wins.push({ opp, count: Math.round(G.beat[id][oppId]) });
      });
      G.recs.forEach((opp) => {
        const c = (G.beat[opp.athlete.id] && G.beat[opp.athlete.id][id]) || 0;
        if (c > 0) losses.push({ opp, count: Math.round(c) });
      });
      // "Best win" = beat the highest-ranked opponent; "worst loss" = lost to lowest-ranked.
      wins.sort((a, b) => a.opp.rank - b.opp.rank);
      losses.sort((a, b) => b.opp.rank - a.opp.rank);
      return {
        bestWins: wins.filter((w) => w.opp.rank < meRank).slice(0, 4),
        notableLosses: losses.filter((l) => l.opp.rank > meRank).slice(0, 4),
      };
    }

    // Team rating = average score of top-5 athletes (XC scoring).
    const teams = [];
    ["M", "F"].forEach((g) => {
      D.TEAMS.forEach((t) => {
        const roster = byGender[g].recs
          .filter((r) => r.team.id === t.id && r.active && r.opponents > 0)
          .sort((a, b) => b.score - a.score);
        if (roster.length < 5) return;
        const top5 = roster.slice(0, 5);
        const rating = top5.reduce((s, r) => s + r.score, 0) / 5;
        const depth = roster.slice(0, 7).reduce((s, r) => s + r.score, 0) / Math.min(7, roster.length);
        teams.push({ team: t, gender: g, rating, depth, roster, top5 });
      });
    });
    ["M", "F"].forEach((g) => {
      teams.filter((x) => x.gender === g).sort((a, b) => b.rating - a.rating)
        .forEach((x, i) => (x.rankG = i + 1));
    });

    return { byGender, recById, allRecs, h2h, notables, teams };
  }

  window.ENGINE = { build };
})();
