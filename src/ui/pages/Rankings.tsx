import { useGame } from "../../state/store";
import { nationalRankings } from "../../state/game";
import { LEAGUE } from "../../engine";

export function Rankings() {
  const save = useGame((s) => s.save)!;
  const rows = nationalRankings(save);
  const playerRank = rows.findIndex((r) => r.programId === save.playerId) + 1;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-black">National rankings</h1>
        <div className="text-sm text-slate-500">Your rank: <span className="font-bold text-slate-900">#{playerRank}</span></div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-2">#</th><th>Program</th><th>Conference</th><th className="text-right">Power</th></tr>
          </thead>
          <tbody>
            {rows.slice(0, 40).map((r, i) => {
              const def = save.programs.find((p) => p.def.id === r.programId)!.def;
              return (
                <tr key={r.programId} className={`border-t border-slate-100 ${r.programId === save.playerId ? "bg-amber-50 font-bold" : ""}`}>
                  <td className="px-4 py-1.5 text-slate-400">{i + 1}</td>
                  <td><span className="mr-2 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: r.color }} />{r.name}</td>
                  <td className="text-slate-500">{LEAGUE.conferences[def.conference]}</td>
                  <td className="text-right tabular-nums">{r.power.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
