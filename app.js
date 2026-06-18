/* Harrier — single-page app (hash routed, no framework)
 * Rankings are head-to-head: see engine.js. */
(function () {
  "use strict";

  const E = window.ENGINE.build();
  const D = window.DATA;
  const app = () => document.getElementById("app");

  // ---- helpers ----
  const fmtTime = (s) => {
    s = Math.round(s);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  };
  const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
  const pct = (n) => `${Math.round(n * 100)}%`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const genderLabel = (g) => (g === "M" ? "Men" : "Women");
  const ordinal = (n) => {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  function scoreColor(score) {
    const t = Math.max(0, Math.min(1, (score - 45) / 50));
    const hue = 25 + t * 120; // 25 amber (low) → 145 green (high)
    return `hsl(${hue}, 45%, 46%)`;
  }
  const recById = (id) => E.recById[id];

  function recordBadge(rec) {
    return `<span class="rec"><span class="w">${rec.wins}</span>–<span class="l">${rec.losses}</span></span>`;
  }

  // ---- score-by-race sparkline (uses per-race finishing strength) ----
  function raceScores(id) {
    // A per-race "strength" proxy for the chart: invert place share in each race.
    const out = [];
    D.RESULTS.filter((x) => x.athleteId === id).forEach((r) => {
      const race = D.raceById[r.raceId];
      const rows = D.RESULTS.filter((x) => x.raceId === r.raceId).sort((a, b) => a.seconds - b.seconds);
      const place = rows.findIndex((x) => x.athleteId === id) + 1;
      const beat = rows.length - place;
      const strength = rows.length > 1 ? beat / (rows.length - 1) : 1; // 0..1
      out.push({ race, place, field: rows.length, order: race.order, time: r.seconds,
        val: 40 + strength * 60 });
    });
    return out.sort((a, b) => a.order - b.order);
  }

  function sparkline(points, w = 220, h = 40) {
    if (points.length < 2) return "";
    const xs = points.map((p) => p.order), ys = points.map((p) => p.val);
    const minY = Math.min(...ys) - 4, maxY = Math.max(...ys) + 4;
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const X = (x) => 6 + ((x - minX) / Math.max(1, maxX - minX)) * (w - 12);
    const Y = (y) => h - 6 - ((y - minY) / Math.max(1, maxY - minY)) * (h - 12);
    const pts = points.map((p) => `${X(p.order).toFixed(1)},${Y(p.val).toFixed(1)}`);
    const dots = points.map((p) => `<circle cx="${X(p.order).toFixed(1)}" cy="${Y(p.val).toFixed(1)}" r="2.6" fill="${scoreColor(p.val)}"></circle>`).join("");
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <polyline points="${pts.join(" ")}" fill="none" stroke="url(#sg)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></polyline>
      <defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7aa979"/><stop offset="1" stop-color="#2f6b46"/></linearGradient></defs>
      ${dots}</svg>`;
  }

  function profileChart(points) {
    if (points.length < 2) return `<div class="muted">Not enough races to chart yet.</div>`;
    const w = 640, h = 232, padL = 30, padB = 40, padT = 14, padR = 16;
    const ys = points.map((p) => p.val);
    const minY = Math.floor(Math.min(...ys) - 4), maxY = Math.ceil(Math.max(...ys) + 4);
    const X = (i) => padL + (i / Math.max(1, points.length - 1)) * (w - padL - padR);
    const Y = (y) => h - padB - ((y - minY) / Math.max(1, maxY - minY)) * (h - padB - padT);
    const line = points.map((p, i) => `${X(i).toFixed(1)},${Y(p.val).toFixed(1)}`).join(" ");
    const dots = points.map((p, i) =>
      `<g><circle cx="${X(i).toFixed(1)}" cy="${Y(p.val).toFixed(1)}" r="5" fill="${scoreColor(p.val)}" stroke="#ffffff" stroke-width="2"></circle>
       <title>${esc(p.race.meet)} (${mdShort(p.race.date)}) — ${ordinal(p.place)} of ${p.field}</title></g>`).join("");
    // Horizontal compact dates (e.g. "5/30"). If there are enough races that
    // labels would touch, show every other one so they stay legible.
    const minGap = 46; // px needed per label
    const step = Math.ceil((points.length * minGap) / (w - padL - padR));
    const xlabels = points.map((p, i) => {
      if (i % step !== 0 && i !== points.length - 1) return "";
      return `<text x="${X(i).toFixed(1)}" y="${h - padB + 18}" class="ax" text-anchor="middle">${mdShort(p.race.date)}</text>`;
    }).join("");
    return `<svg class="chart" viewBox="0 0 ${w} ${h}">
      <polyline points="${line}" fill="none" stroke="url(#cg)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
      <defs><linearGradient id="cg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7aa979"/><stop offset="1" stop-color="#2f6b46"/></linearGradient></defs>
      ${dots}${xlabels}</svg>`;
  }
  // "2026-05-30" → "5/30"
  function mdShort(d) {
    const [, m, day] = d.split("-");
    return `${parseInt(m, 10)}/${parseInt(day, 10)}`;
  }
  function shortMeet(m) {
    return m.replace("Championships", "Champs").replace("Invitational", "Inv.").replace("Invite", "Inv.").replace("Conference", "Conf.").replace("NCAA ", "");
  }

  // ---- views ----
  function viewHome() {
    const men = E.byGender.M.ranked.slice(0, 5);
    const women = E.byGender.F.ranked.slice(0, 5);
    const undef = E.allRecs.filter((r) => r.losses === 0 && r.wins > 4).sort((a, b) => b.wins - a.wins).slice(0, 5);

    return `
    <section class="hero">
      <h1>NCAA Division I distance rankings</h1>
      <p class="lede">Rankings come from <strong>head-to-head results</strong> — who finished ahead of
      whom — across track 5,000m / 10,000m and cross country.</p>
      <div class="hero-cta">
        <a class="btn btn-primary" href="#/rankings/M">View rankings</a>
        <a class="btn" href="#/methodology">How the rating works</a>
      </div>
      <p class="notice">Preliminary 2026 men's rankings, built from outdoor track 5,000m and 10,000m
      results. Cross country races fold in as they are added.</p>
    </section>
    <div class="home-grid">
      ${leaderCard("Men · Top 5", men)}
      ${women.length ? leaderCard("Women · Top 5", women) : ""}
      <div class="card">
        <div class="card-head"><h3>Undefeated</h3><span class="muted">most wins, no losses</span></div>
        <ol class="mini-list">
          ${undef.length ? undef.map((r) => `<li>
            <a href="#/athlete/${r.athlete.id}">${esc(r.athlete.name)}</a>
            <span class="muted">${esc(r.team.abbr)} · ${genderLabel(r.athlete.gender)}</span>
            ${recordBadge(r)}</li>`).join("") : `<li class="muted">No unbeaten athletes yet.</li>`}
        </ol>
      </div>
    </div>`;
  }

  function leaderCard(title, list) {
    const g = list[0] ? list[0].athlete.gender : "M";
    return `<div class="card">
      <div class="card-head"><h3>${esc(title)}</h3><a class="muted" href="#/rankings/${g}">full list →</a></div>
      <ol class="mini-list">
        ${list.map((r) => `<li>
          <span class="rk">${r.rank}</span>
          <a href="#/athlete/${r.athlete.id}">${esc(r.athlete.name)}</a>
          <span class="muted">${esc(r.team.abbr)}</span>
          <span class="score-pill" style="background:${scoreColor(r.score)}">${f1(r.score)}</span>
        </li>`).join("")}
      </ol></div>`;
  }

  function viewRankings(gender) {
    gender = gender === "F" ? "F" : "M";
    const list = E.byGender[gender].ranked;
    return `
    <div class="page-head">
      <div><h2>National rankings</h2>
        <p class="muted">${list.length} ranked · ${genderLabel(gender)} · head-to-head · 2026</p></div>
      ${genderToggle("rankings", gender)}
    </div>
    <div class="table-wrap">
    <table class="rank-table">
      <thead><tr><th>#</th><th>Athlete</th><th>Team</th><th>Yr</th>
        <th class="num">Rating</th><th class="num">Record</th><th class="num">Win%</th><th>Season</th></tr></thead>
      <tbody>
        ${list.map((r) => `<tr>
          <td class="rk">${r.rank}</td>
          <td><a href="#/athlete/${r.athlete.id}">${esc(r.athlete.name)}</a></td>
          <td><a class="muted" href="#/team/${r.team.id}/${gender}">${esc(r.team.abbr)}</a></td>
          <td class="muted">${esc(r.athlete.year)}</td>
          <td class="num"><span class="score-pill" style="background:${scoreColor(r.score)}">${f1(r.score)}</span></td>
          <td class="num">${recordBadge(r)}</td>
          <td class="num mono">${pct(r.winPct)}</td>
          <td class="spark-cell">${sparkline(raceScores(r.athlete.id))}</td>
        </tr>`).join("")}
      </tbody>
    </table></div>`;
  }

  function genderToggle(route, gender) {
    return `<div class="seg">
      <a class="${gender === "M" ? "on" : ""}" href="#/${route}/M">Men</a>
      <a class="${gender === "F" ? "on" : ""}" href="#/${route}/F">Women</a></div>`;
  }

  function viewAthlete(id) {
    const r = recById(id);
    if (!r) return notFound("athlete");
    const a = r.athlete;
    const points = raceScores(id);
    const { bestWins, notableLosses } = E.notables(id);
    const teammates = E.byGender[a.gender].recs
      .filter((x) => x.team.id === r.team.id && x.athlete.id !== id).slice(0, 5);
    // "Ranked near you" only applies to ranked athletes; anchor at this
    // athlete's rank, or the bottom of the list if they're not yet ranked.
    const anchor = r.rank || E.byGender[a.gender].ranked.length;
    const near = E.byGender[a.gender].ranked
      .filter((x) => x.athlete.id !== id)
      .map((x) => ({ x, d: Math.abs(x.rank - anchor) }))
      .sort((p, q) => p.d - q.d).slice(0, 5).map((o) => o.x);

    return `
    <a class="back" href="#/rankings/${a.gender}">← rankings</a>
    <section class="profile-head">
      <div class="ph-id">
        <div class="avatar" style="--c:${scoreColor(r.score)}">${initials(a.name)}</div>
        <div><h1>${esc(a.name)}</h1>
          <p class="muted"><a href="#/team/${r.team.id}/${a.gender}">${esc(r.team.name)}</a>
            · ${genderLabel(a.gender)} · ${esc(a.year)} · ${esc(r.team.conference)}</p></div>
      </div>
      <div class="ph-rating">
        <div class="big-score" style="color:${scoreColor(r.score)}">${r.rank ? "#" + r.rank : "NR"}</div>
        <div class="muted">${r.rank ? "national · " + genderLabel(a.gender) : "not yet ranked"}</div></div>
    </section>

    <div class="stat-strip">
      ${stat(`<span class="score-pill big" style="background:${scoreColor(r.score)}">${f1(r.score)}</span>`, "Harrier rating")}
      ${stat(`${r.wins}–${r.losses}`, "head-to-head record")}
      ${stat(pct(r.winPct), "win rate")}
      ${stat(`<span style="color:${scoreColor(r.sos)}">${f1(r.sos)}</span>`, "strength of schedule")}
      ${stat(`${r.raceCount}`, "races")}
    </div>

    <div class="profile-grid">
      <div class="card">
        <div class="card-head"><h3>Season trajectory</h3><span class="muted">finishing strength by race</span></div>
        ${profileChart(points)}
      </div>
      <div class="card">
        <div class="card-head"><h3>Signature wins</h3><span class="muted">beat higher-ranked</span></div>
        <ol class="mini-list">
          ${bestWins.length ? bestWins.map((w) => `<li>
            <a href="#/athlete/${w.opp.athlete.id}">${esc(w.opp.athlete.name)}</a>
            <span class="muted">#${w.opp.rank}</span>
            <span class="rec ok">beat ×${w.count}</span></li>`).join("")
            : `<li class="muted">No wins over higher-ranked athletes yet.</li>`}
        </ol>
        <div class="card-head" style="margin-top:14px"><h3>Notable losses</h3><span class="muted">lost to lower-ranked</span></div>
        <ol class="mini-list">
          ${notableLosses.length ? notableLosses.map((l) => `<li>
            <a href="#/athlete/${l.opp.athlete.id}">${esc(l.opp.athlete.name)}</a>
            <span class="muted">#${l.opp.rank}</span>
            <span class="rec bad">lost ×${l.count}</span></li>`).join("")
            : `<li class="muted">No losses to lower-ranked athletes.</li>`}
        </ol>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3>Race log</h3><span class="muted">cross country + track 5k/10k</span></div>
      <div class="table-wrap">
      <table class="rank-table">
        <thead><tr><th>Date</th><th>Meet</th><th>Type</th><th class="num">Time</th><th class="num">Place</th><th class="num">Beat</th></tr></thead>
        <tbody>
          ${points.map((p) => `<tr>
            <td class="muted mono">${esc(p.race.date.slice(5))}</td>
            <td><a href="#/race/${p.race.id}">${esc(p.race.meet)}</a></td>
            <td>${typePill(p.race)}</td>
            <td class="num mono">${fmtTime(p.time)}</td>
            <td class="num">${ordinal(p.place)} <span class="muted">/ ${p.field}</span></td>
            <td class="num">${p.field - p.place}</td>
          </tr>`).join("")}
        </tbody>
      </table></div>
    </div>

    <div class="profile-grid">
      <div class="card">
        <div class="card-head"><h3>Ranked near you</h3><a class="muted" href="#/rankings/${a.gender}">full list →</a></div>
        <ol class="mini-list">
          ${near.map((x) => `<li><span class="rk">${x.rank}</span>
            <a href="#/athlete/${x.athlete.id}">${esc(x.athlete.name)}</a>
            <span class="muted">${esc(x.team.abbr)}</span>
            ${h2hMini(id, x.athlete.id)}
            <span class="score-pill" style="background:${scoreColor(x.score)}">${f1(x.score)}</span></li>`).join("")}
        </ol>
      </div>
      <div class="card">
        <div class="card-head"><h3>Teammates</h3><a class="muted" href="#/team/${r.team.id}/${a.gender}">team →</a></div>
        <ol class="mini-list">
          ${teammates.map((t) => `<li><span class="rk">${t.rank}</span>
            <a href="#/athlete/${t.athlete.id}">${esc(t.athlete.name)}</a>
            <span class="muted">${esc(t.athlete.year)}</span>
            <span class="score-pill" style="background:${scoreColor(t.score)}">${f1(t.score)}</span></li>`).join("")}
        </ol>
      </div>
    </div>`;
  }

  function h2hMini(idA, idB) {
    const { aWins, bWins } = E.h2h(idA, idB);
    if (aWins + bWins === 0) return `<span class="muted h2h">—</span>`;
    const cls = aWins > bWins ? "ok" : aWins < bWins ? "bad" : "";
    return `<span class="rec h2h ${cls}" title="head-to-head">${aWins}–${bWins}</span>`;
  }

  function typePill(race) {
    if (race.type === "TRACK") return `<span class="pill pt">${race.distanceM / 1000}k track</span>`;
    return `<span class="pill px">XC ${race.distanceM / 1000}k</span>`;
  }

  function viewTeams(gender) {
    gender = gender === "F" ? "F" : "M";
    const list = E.teams.filter((t) => t.gender === gender).sort((a, b) => b.rating - a.rating);
    return `
    <div class="page-head"><div><h2>Team rankings</h2>
      <p class="muted">top-5 scoring · ${genderLabel(gender)}</p></div>${genderToggle("teams", gender)}</div>
    <div class="table-wrap">
    <table class="rank-table">
      <thead><tr><th>#</th><th>Team</th><th>Conf.</th><th class="num">Team rating</th><th class="num">Depth (7)</th><th>Scoring five</th></tr></thead>
      <tbody>
        ${list.map((t, i) => `<tr>
          <td class="rk">${i + 1}</td>
          <td><a href="#/team/${t.team.id}/${gender}">${esc(t.team.name)}</a></td>
          <td class="muted">${esc(t.team.conference)}</td>
          <td class="num"><span class="score-pill" style="background:${scoreColor(t.rating)}">${f1(t.rating)}</span></td>
          <td class="num">${f1(t.depth)}</td>
          <td class="five">${t.top5.map((x) => `<a href="#/athlete/${x.athlete.id}" title="${esc(x.athlete.name)} · #${x.rank}" class="dot" style="background:${scoreColor(x.score)}"></a>`).join("")}</td>
        </tr>`).join("")}
      </tbody></table></div>`;
  }

  function viewTeam(id, gender) {
    gender = gender === "F" ? "F" : "M";
    const team = D.teamById[id];
    if (!team) return notFound("team");
    const t = E.teams.find((x) => x.team.id === id && x.gender === gender);
    const roster = E.byGender[gender].recs.filter((x) => x.team.id === id);
    if (!roster.length) return `<a class="back" href="#/teams/${gender}">← teams</a><p class="muted">No ${genderLabel(gender).toLowerCase()} roster for ${esc(team.name)} in the demo.</p>`;
    return `
    <a class="back" href="#/teams/${gender}">← teams</a>
    <section class="profile-head">
      <div class="ph-id"><div class="avatar" style="--c:${t ? scoreColor(t.rating) : "#888"}">${esc(team.abbr)}</div>
        <div><h1>${esc(team.name)}</h1>
          <p class="muted">${esc(team.conference)} · ${genderLabel(gender)} · ${roster.length} on roster</p></div></div>
      ${t ? `<div class="ph-rating"><div class="big-score" style="color:${scoreColor(t.rating)}">${ordinal(t.rankG)}</div>
        <div class="muted">national team rank</div></div>` : ""}
      <div class="seg seg-sm" style="margin-left:14px">
        <a class="${gender === "M" ? "on" : ""}" href="#/team/${id}/M">Men</a>
        <a class="${gender === "F" ? "on" : ""}" href="#/team/${id}/F">Women</a></div>
    </section>
    <div class="table-wrap">
    <table class="rank-table">
      <thead><tr><th>#</th><th>Athlete</th><th>Yr</th><th class="num">Nat'l</th><th class="num">Rating</th><th class="num">Record</th><th>Season</th></tr></thead>
      <tbody>
        ${roster.map((a, i) => `<tr class="${i < 5 ? "scoring" : ""}">
          <td class="rk">${i + 1}${i < 5 ? '<span class="s5" title="scoring five">•</span>' : ""}</td>
          <td><a href="#/athlete/${a.athlete.id}">${esc(a.athlete.name)}</a></td>
          <td class="muted">${esc(a.athlete.year)}</td>
          <td class="num muted">${a.rank ? "#" + a.rank : "—"}</td>
          <td class="num"><span class="score-pill" style="background:${scoreColor(a.score)}">${f1(a.score)}</span></td>
          <td class="num">${recordBadge(a)}</td>
          <td class="spark-cell">${sparkline(raceScores(a.athlete.id))}</td>
        </tr>`).join("")}
      </tbody></table></div>`;
  }

  function viewRaces() {
    const byDate = [...D.RACES].sort((a, b) => b.date.localeCompare(a.date) || a.gender.localeCompare(b.gender));
    return `
    <div class="page-head"><div><h2>Races</h2><p class="muted">${D.RACES.length} races · XC + track 5k/10k</p></div></div>
    <div class="race-list">
      ${byDate.map((r) => {
        const n = D.RESULTS.filter((p) => p.raceId === r.id).length;
        return `<a class="race-row" href="#/race/${r.id}">
          <div class="rr-date mono">${esc(r.date.slice(5))}</div>
          <div class="rr-main"><div class="rr-meet">${esc(r.meet)} <span class="pill ${r.gender === "M" ? "pm" : "pf"}">${genderLabel(r.gender)}</span> ${typePill(r)}</div>
            <div class="muted">${esc(r.courseName)} · ${esc(r.place)}</div></div>
          <div class="rr-n muted">${n} finishers →</div></a>`;
      }).join("")}
    </div>`;
  }

  function viewRace(id) {
    const r = D.raceById[id];
    if (!r) return notFound("race");
    const rows = D.RESULTS.filter((p) => p.raceId === id).sort((a, b) => a.seconds - b.seconds);
    const win = rows[0];
    return `
    <a class="back" href="#/races">← races</a>
    <section class="profile-head">
      <div class="ph-id"><div class="avatar" style="--c:#2f6b46">${esc((r.courseName || "XC").slice(0, 2).toUpperCase())}</div>
        <div><h1>${esc(r.meet)} <span class="pill ${r.gender === "M" ? "pm" : "pf"}">${genderLabel(r.gender)}</span></h1>
          <p class="muted">${esc(r.courseName)} · ${esc(r.place)} · ${esc(r.date)} · ${typePill(r).replace(/<[^>]+>/g, "")}</p></div></div>
    </section>
    <div class="table-wrap">
    <table class="rank-table">
      <thead><tr><th>Pl</th><th>Athlete</th><th>Team</th><th class="num">Time</th><th class="num">Gap</th></tr></thead>
      <tbody>
        ${rows.map((p, i) => `<tr>
          <td class="rk">${i + 1}</td>
          <td><a href="#/athlete/${p.athleteId}">${esc(D.athleteById[p.athleteId].name)}</a></td>
          <td><a class="muted" href="#/team/${p.teamId}/${r.gender}">${esc(D.teamById[p.teamId].abbr)}</a></td>
          <td class="num mono">${fmtTime(p.seconds)}</td>
          <td class="num mono muted">${i === 0 ? "—" : "+" + fmtTime(p.seconds - win.seconds)}</td>
        </tr>`).join("")}
      </tbody></table></div>`;
  }

  function viewMethodology() {
    return `
    <div class="page-head"><div><h2>Methodology</h2>
      <p class="muted">How a rating is computed.</p></div></div>
    <div class="prose card">
      <h3>1 · Inputs</h3>
      <p>Each race contributes its finishing order and finish times. For every pair of athletes in a
      race, the faster finisher records a win over the slower one. Ratings are computed separately for
      men and women.</p>

      <h3>2 · Rating model</h3>
      <p>Every athlete is assigned a single rating <em>r</em>. For a matchup, the model expects the
      rating difference <em>r<sub>i</sub> − r<sub>j</sub></em> to equal the observed margin between the
      two athletes. All matchups are stacked into one weighted least-squares system and solved at once:</p>
      <p class="mono eq">(MᵀW M + λI) r = MᵀW b</p>
      <p><em>M</em> encodes each pairwise comparison (+1 for the winner, −1 for the loser), <em>b</em> is
      the margin, and <em>W</em> holds the per-comparison weights below. The ridge term <em>λI</em>
      keeps athletes with few results near the mean and guarantees a unique solution.</p>

      <h3>3 · Transitivity</h3>
      <p>Because all comparisons are solved jointly, strength propagates through the network: if A beats
      B and B beats C, A's rating reflects a result over C even with no direct meeting.</p>

      <h3>4 · Margin weighting</h3>
      <p>Each comparison carries a strong fixed base weight plus a small bonus for a larger time gap,
      clipped to a narrow range. A win is close to a win regardless of margin, so a narrow result over a
      strong opponent is not outweighed by a large gap over a weak one.</p>

      <h3>5 · Field-strength weighting</h3>
      <p>Each race is weighted by the quality of its field, measured from the ratings of the athletes in
      it. This is solved iteratively: rate the athletes, score every field from those ratings, re-weight,
      and repeat until stable. Beating a strong field counts for more than beating a weak one.</p>

      <h3>6 · Strength of competition</h3>
      <p>Because all results are solved jointly, the value of a result depends on whom it was against.
      Finishing last in a field of national contenders still places an athlete above someone who won a
      weak race: the loser was measured against highly-rated runners, and the least-squares fit propagates
      that. Each athlete also carries a strength-of-schedule figure — the average rating of every opponent
      actually faced — so this is visible, not just implicit.</p>

      <h3>7 · Recency weighting</h3>
      <p>More recent races receive higher weight, so the ratings track current form.</p>

      <h3>8 · Rating scale</h3>
      <p>Raw ratings are mapped to a 0–100 scale within each gender, anchored so the strongest athletes
      sit near the top of the range and remain clearly separated. National rank is the order of the raw
      ratings among active athletes.</p>

      <h3>9 · Teams</h3>
      <p>A team's rating is the mean rating of its top five athletes, with a separate figure across the
      top seven for depth.</p>
    </div>`;
  }

  // ---- small components ----
  function stat(value, label) {
    return `<div class="stat"><div class="stat-v">${value}</div><div class="stat-l">${esc(label)}</div></div>`;
  }
  function initials(name) { return name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase(); }
  function notFound(what) {
    return `<div class="empty"><h2>Not found</h2><p class="muted">That ${esc(what)} isn't in the demo.</p><a class="btn" href="#/">Go home</a></div>`;
  }

  // ---- search ----
  function runSearch(q) {
    q = q.trim().toLowerCase();
    const box = document.getElementById("searchResults");
    if (!q) { box.hidden = true; box.innerHTML = ""; return; }
    const aMatches = E.allRecs.filter((r) => r.athlete.name.toLowerCase().includes(q))
      .sort((a, b) => b.score - a.score).slice(0, 6);
    const tMatches = D.TEAMS.filter((t) => t.name.toLowerCase().includes(q) || t.abbr.toLowerCase().includes(q)).slice(0, 4);
    if (!aMatches.length && !tMatches.length) { box.hidden = false; box.innerHTML = `<div class="sr-empty">No matches</div>`; return; }
    box.hidden = false;
    box.innerHTML =
      aMatches.map((r) => `<a class="sr-item" href="#/athlete/${r.athlete.id}">
        <span class="sr-dot" style="background:${scoreColor(r.score)}"></span>
        <span>${esc(r.athlete.name)}</span>
        <span class="muted">${esc(r.team.abbr)} · ${r.rank ? "#" + r.rank : "NR"} ${genderLabel(r.athlete.gender)}</span>
        <span class="score-pill sm" style="background:${scoreColor(r.score)}">${f1(r.score)}</span></a>`).join("") +
      tMatches.map((t) => `<a class="sr-item" href="#/team/${t.id}/M">
        <span class="sr-dot team"></span><span>${esc(t.name)}</span>
        <span class="muted">team · ${esc(t.conference)}</span></a>`).join("");
  }

  // ---- router ----
  function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    let html;
    switch (parts[0]) {
      case undefined: case "": html = viewHome(); break;
      case "rankings": html = viewRankings(parts[1]); break;
      case "teams": html = viewTeams(parts[1]); break;
      case "team": html = viewTeam(parts[1], parts[2]); break;
      case "athlete": html = viewAthlete(parts[1]); break;
      case "races": html = viewRaces(); break;
      case "race": html = viewRace(parts[1]); break;
      case "methodology": html = viewMethodology(); break;
      default: html = notFound("page");
    }
    app().innerHTML = html;
    document.querySelectorAll(".nav-links a").forEach((el) => el.classList.toggle("active", el.dataset.nav === parts[0]));
    window.scrollTo(0, 0);
    const box = document.getElementById("searchResults");
    if (box) box.hidden = true;
  }

  function init() {
    const s = document.getElementById("search");
    s.addEventListener("input", (e) => runSearch(e.target.value));
    s.addEventListener("focus", (e) => { if (e.target.value) runSearch(e.target.value); });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".nav-search")) {
        const box = document.getElementById("searchResults");
        if (box) box.hidden = true;
      }
    });
    window.addEventListener("hashchange", route);
    route();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
