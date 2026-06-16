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

  function recencyWeight(order, maxOrder) {
    return 1 + (order / Math.max(1, maxOrder)) * 1.2; // 1.0 → 2.2 across season
  }

  function buildGender(gender) {
    const athletes = D.ATHLETES.filter((a) => a.gender === gender);
    const idx = Object.fromEntries(athletes.map((a, i) => [a.id, i]));
    const n = athletes.length;
    const maxOrder = Math.max(...D.RACES.map((r) => r.order), 1);

    // Pairwise tallies and aggregate matchup matrix for Massey.
    const beat = {};      // beat[a][b] = weighted count a finished ahead of b
    const meetings = {};  // meetings[a][b] = weighted total races a & b both ran
    const W = new Float64Array(n);          // weighted wins
    const L = new Float64Array(n);          // weighted losses
    const games = new Float64Array(n);      // weighted games played
    const M = [];                            // Massey normal matrix
    const b = new Float64Array(n);
    for (let i = 0; i < n; i++) M.push(new Float64Array(n));

    const races = D.RACES.filter((r) => r.gender === gender);
    let totalComparisons = 0;

    races.forEach((race) => {
      const rows = D.RESULTS.filter((x) => x.raceId === race.id)
        .filter((x) => idx[x.athleteId] !== undefined)
        .sort((p, q) => p.seconds - q.seconds);
      const w = recencyWeight(race.order, maxOrder);

      for (let p = 0; p < rows.length; p++) {
        for (let q = p + 1; q < rows.length; q++) {
          const winner = rows[p], loser = rows[q];
          const wi = idx[winner.athleteId], li = idx[loser.athleteId];
          // Margin signal: closer finishes are weaker evidence than blowouts,
          // but cap so a huge gap doesn't dominate. Normalize by race distance.
          const gap = (loser.seconds - winner.seconds) / winner.seconds; // fractional
          const margin = Math.max(0.15, Math.min(1, gap * 18 + 0.15));
          const wgt = w * margin;

          W[wi] += w; L[li] += w;
          games[wi] += w; games[li] += w;
          (beat[winner.athleteId] ||= {});
          beat[winner.athleteId][loser.athleteId] = (beat[winner.athleteId][loser.athleteId] || 0) + w;
          (meetings[winner.athleteId] ||= {});
          meetings[winner.athleteId][loser.athleteId] = (meetings[winner.athleteId][loser.athleteId] || 0) + w;
          (meetings[loser.athleteId] ||= {});
          meetings[loser.athleteId][winner.athleteId] = (meetings[loser.athleteId][winner.athleteId] || 0) + w;

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

    // Map raw ratings → 0–100. Center on field, scale by spread.
    const mean = rating.reduce((s, x) => s + x, 0) / Math.max(1, n);
    const sd = Math.sqrt(rating.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, n)) || 1;
    const scoreOf = (r) => Math.max(1, Math.min(100, 72 + ((r - mean) / sd) * 13));

    // Assemble per-athlete records.
    const recs = athletes.map((a) => {
      const wins = W[idx[a.id]], losses = L[idx[a.id]];
      const raw = rating[idx[a.id]];
      const myRaces = D.RESULTS.filter((x) => x.athleteId === a.id).length;
      return {
        athlete: a, team: D.teamById[a.teamId],
        raw, score: scoreOf(raw),
        wins: Math.round(wins), losses: Math.round(losses),
        winPct: wins + losses > 0 ? wins / (wins + losses) : 0,
        raceCount: myRaces,
        _idx: idx[a.id],
      };
    });

    // National rank within gender by rating.
    recs.sort((x, y) => y.raw - x.raw);
    recs.forEach((r, i) => {
      r.rank = i + 1;
      r.percentile = 100 * (1 - i / Math.max(1, recs.length - 1));
      r.fieldSize = recs.length;
    });

    return { athletes, recs, recById: Object.fromEntries(recs.map((r) => [r.athlete.id, r])),
      beat, meetings, scoreOf, maxOrder };
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
    const M = buildGender("M");
    const F = buildGender("F");
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
          .filter((r) => r.team.id === t.id)
          .sort((a, b) => b.raw - a.raw);
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
