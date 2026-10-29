import { useMemo, useState } from "react";
import { buildLeague, simulateMeet, Rng, LEAGUE } from "../engine";
import type { Meet, RaceEntrant } from "../engine";

/**
 * Phase 1–2 preview UI: builds the league deterministically and simulates a
 * marquee invitational so the race engine + XC scoring are visible. Full game
 * screens (dashboard, roster, training, recruiting, …) arrive in Phase 4.
 */
export function App() {
  const [seed] = useState(2026);
  const playerId = "oregon";
  const programs = useMemo(() => buildLeague(seed, playerId), [seed]);
  const player = programs.find((p) => p.isPlayer)!;
  const nameById = useMemo(() => new Map(programs.map((p) => [p.def.id, p.def])), [programs]);

  const { meet, result, field } = useMemo(() => {
    const field = [...programs].sort((a, b) => b.prestige - a.prestige).slice(0, 8);
    const meet: Meet = {
      id: "madison-inv", name: "Madison Invitational", tier: "regular", week: 4,
      prestige: 80, travelCost: 20,
      course: { distance: 8000, terrain: 0.35, firmness: 0.7, altitude: 260 },
    };
    const entrants: RaceEntrant[] = field.map((p) => ({
      programId: p.def.id,
      athletes: p.roster.filter((a) => a.status.kind === "healthy")
        .sort((a, b) => b.starRating - a.starRating).slice(0, 7),
      shoeTier: p.budget.investments.shoeTier,
    }));
    const result = simulateMeet(meet, entrants, new Rng(seed).fork("ui:meet"));
    return { meet, result, field };
  }, [programs, seed]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
  const athName = (pid: string, aid: string) => {
    const p = programs.find((x) => x.def.id === pid)!;
    const a = p.roster.find((x) => x.id === aid)!;
    return `${a.firstName} ${a.lastName}`;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-black tracking-tight">Cross Country Manager</h1>
        <p className="text-slate-500">
          Phases 1–2 · {LEAGUE.programs.length} programs · 9 regions ·{" "}
          {Object.keys(LEAGUE.conferences).length} conferences · seed {seed}
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-bold">Your program</h2>
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 rounded" style={{ background: player.def.colorPrimary }} />
          <span className="text-xl font-semibold">{player.def.name}</span>
          <span className="text-slate-500">
            {LEAGUE.conferences[player.def.conference]} · prestige {player.prestige} · {player.coach.philosophy}
          </span>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-bold">{meet.name}</h2>
          <p className="mb-3 text-sm text-slate-500">
            {meet.course.distance / 1000}k · team scores (top 5 score)
          </p>
          <table className="w-full text-sm">
            <tbody>
              {result.teamScores.map((t) => {
                const def = nameById.get(t.programId)!;
                return (
                  <tr key={t.programId} className="border-t border-slate-100">
                    <td className="w-8 py-1 text-slate-400">{t.teamPlace}</td>
                    <td>
                      <span className="mr-2 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: def.colorPrimary }} />
                      {def.name}
                    </td>
                    <td className="text-right font-semibold tabular-nums">{t.score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">Top finishers</h2>
          <table className="w-full text-sm">
            <tbody>
              {result.runners.slice(0, 15).map((r) => {
                const def = nameById.get(r.programId)!;
                return (
                  <tr key={r.athleteId} className="border-t border-slate-100">
                    <td className="w-8 py-1 text-slate-400">{r.place}</td>
                    <td>{athName(r.programId, r.athleteId)}</td>
                    <td className="text-slate-500">
                      <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: def.colorPrimary }} />
                      {def.name}
                    </td>
                    <td className="text-right tabular-nums">{fmt(r.timeSec)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Field: {field.map((p) => p.def.name).join(" · ")}
      </p>
    </div>
  );
}
