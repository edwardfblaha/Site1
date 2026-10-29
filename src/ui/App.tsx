import { useMemo, useState } from "react";
import { buildLeague, LEAGUE } from "../engine";
import type { Program } from "../engine";

/**
 * Phase 1 placeholder UI: proves the scaffold boots and the engine builds the
 * league deterministically. Real screens (dashboard, roster, training, …)
 * arrive in Phase 4.
 */
export function App() {
  const [seed] = useState(2026);
  const playerId = "oregon";
  const programs = useMemo(() => buildLeague(seed, playerId), [seed]);
  const player = programs.find((p) => p.isPlayer)!;

  const topByPrestige = [...programs].sort((a, b) => b.prestige - a.prestige).slice(0, 12);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-black tracking-tight">Cross Country Manager</h1>
        <p className="text-slate-500">
          Phase 1 scaffold · {LEAGUE.programs.length} programs · 9 regions ·{" "}
          {Object.keys(LEAGUE.conferences).length} conferences · seed {seed}
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-bold">Your program</h2>
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 rounded" style={{ background: player.def.colorPrimary }} />
          <span className="text-xl font-semibold">{player.def.name}</span>
          <span className="text-slate-500">
            {LEAGUE.conferences[player.def.conference]} · prestige {player.prestige} ·{" "}
            {player.coach.philosophy}
          </span>
        </div>
        <RosterPreview program={player} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">Top programs by prestige</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {topByPrestige.map((p) => (
            <div key={p.def.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <span className="h-3 w-3 rounded-sm" style={{ background: p.def.colorPrimary }} />
              <span className="font-medium">{p.def.name}</span>
              <span className="ml-auto text-sm text-slate-500">{p.prestige}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function RosterPreview({ program }: { program: Program }) {
  const top = [...program.roster].sort((a, b) => b.starRating - a.starRating).slice(0, 7);
  return (
    <table className="mt-4 w-full text-sm">
      <thead className="text-left text-slate-500">
        <tr>
          <th className="py-1">Athlete</th><th>Yr</th><th>Hometown</th>
          <th className="text-right">★</th><th className="text-right">Aerobic</th><th className="text-right">Thr</th>
        </tr>
      </thead>
      <tbody>
        {top.map((a) => (
          <tr key={a.id} className="border-t border-slate-100">
            <td className="py-1 font-medium">{a.firstName} {a.lastName}</td>
            <td>{a.classYear}</td>
            <td className="text-slate-500">{a.hometown}</td>
            <td className="text-right">{a.starRating}</td>
            <td className="text-right">{a.attrs.aerobic}</td>
            <td className="text-right">{a.attrs.threshold}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
