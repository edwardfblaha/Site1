import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../../state/store";
import { LEAGUE } from "../../engine";
import { importSave as readFile } from "../../state/save";
import { Crest } from "../components/art";

export function NewGame() {
  const nav = useNavigate();
  const newGame = useGame((s) => s.newGame);
  const loadExisting = useGame((s) => s.loadExisting);
  const importSave = useGame((s) => s.importSave);

  const [seed, setSeed] = useState(2026);
  const sorted = [...LEAGUE.programs].sort((a, b) => b.prestige - a.prestige);
  const [programId, setProgramId] = useState(sorted[8]?.id ?? sorted[0].id);
  const chosen = LEAGUE.programs.find((p) => p.id === programId)!;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8 flex items-center gap-4">
        <Crest name={chosen.name} color={chosen.colorPrimary} size={72} />
        <div>
          <h1 className="text-4xl font-black tracking-tight">Cross Country Manager</h1>
          <p className="text-slate-400">Coach a Division-I program to a national title — season after season.</p>
        </div>
      </div>

      <div className="panel p-6">
        <h2 className="mb-4 text-lg font-black">Start a career</h2>

        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Choose your program</label>
        <div className="mb-4 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
          {sorted.map((p) => {
            const sel = p.id === programId;
            return (
              <button key={p.id} onClick={() => setProgramId(p.id)}
                className={`flex items-center gap-2 rounded-xl border p-2.5 text-left ${sel ? "border-white bg-white/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}
                style={sel ? { boxShadow: `0 0 0 2px ${p.colorPrimary}` } : undefined}>
                <Crest name={p.name} color={p.colorPrimary} size={30} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{p.name}</div>
                  <div className="text-[11px] text-slate-400">prestige {p.prestige}</div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="mb-5 text-sm text-slate-400">
          {chosen.name} · {LEAGUE.conferences[chosen.conference]} · prestige {chosen.prestige}
        </div>

        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Seed (same seed = same world)</label>
        <input type="number" value={seed} onChange={(e) => setSeed(parseInt(e.target.value || "0", 10))}
          className="mb-5 w-40 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-slate-100" />

        <div className="flex flex-wrap gap-3">
          <button className="btn-accent" onClick={() => { newGame(seed, programId); nav("/hub"); }}>Start career →</button>
          <button className="btn-ghost" onClick={() => { if (loadExisting()) nav("/hub"); else alert("No saved game found."); }}>Continue (autosave)</button>
          <label className="btn-ghost cursor-pointer">
            Import save
            <input type="file" accept="application/json" className="hidden"
              onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { importSave(await readFile(f)); nav("/hub"); } catch { alert("Could not read save file."); } } }} />
          </label>
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-500">Fully fictional: programs are named for their city/region and a color; athletes are procedurally generated.</p>
    </div>
  );
}
