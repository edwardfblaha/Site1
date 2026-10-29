import { useGame } from "../../state/store";
import { nationalRankings } from "../../state/game";
import { LEAGUE } from "../../engine";
import { Crest } from "../components/art";

export function Rankings() {
  const save = useGame((s) => s.save)!;
  const rows = nationalRankings(save);
  const playerRank = rows.findIndex((r) => r.programId === save.playerId) + 1;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-black">National rankings</h1>
        <div className="text-sm text-slate-400">Your rank <span className="font-black text-[color:var(--accent)]">#{playerRank}</span></div>
      </div>
      <div className="panel divide-y divide-white/5 overflow-hidden">
        {rows.slice(0, 40).map((r, i) => {
          const def = save.programs.find((p) => p.def.id === r.programId)!.def;
          const me = r.programId === save.playerId;
          return (
            <div key={r.programId} className={`flex items-center gap-3 px-4 py-2 ${me ? "bg-[color:var(--accent)]/15" : ""}`}>
              <span className={`w-7 text-center text-sm font-black ${i < 3 ? "text-amber-400" : "text-slate-500"}`}>{i + 1}</span>
              <Crest name={def.name} color={def.colorPrimary} size={26} />
              <div className="flex-1">
                <div className={`text-sm ${me ? "font-black" : "font-semibold"}`}>{def.name}</div>
                <div className="text-xs text-slate-500">{LEAGUE.conferences[def.conference]}</div>
              </div>
              <span className="tabular-nums text-sm text-slate-300">{r.power.toFixed(1)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
