import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../../state/store";
import { LEAGUE } from "../../engine";
import { importSave as readFile } from "../../state/save";

export function NewGame() {
  const nav = useNavigate();
  const newGame = useGame((s) => s.newGame);
  const loadExisting = useGame((s) => s.loadExisting);
  const importSave = useGame((s) => s.importSave);

  const [seed, setSeed] = useState(2026);
  const [programId, setProgramId] = useState(
    [...LEAGUE.programs].sort((a, b) => b.prestige - a.prestige)[8]?.id ?? LEAGUE.programs[0].id
  );

  const sorted = [...LEAGUE.programs].sort((a, b) => b.prestige - a.prestige);

  function start() {
    newGame(seed, programId);
    nav("/season");
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <h1 className="text-4xl font-black tracking-tight">Cross Country Manager</h1>
      <p className="mt-2 text-slate-500">
        Take over a Division I men's cross country program. Train, recruit, manage a budget,
        and chase a national title across multi-season careers.
      </p>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold">New career</h2>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Choose a program</label>
        <select value={programId} onChange={(e) => setProgramId(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2">
          {sorted.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {LEAGUE.conferences[p.conference]} · prestige {p.prestige}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Seed (same seed = same world)</label>
        <input type="number" value={seed} onChange={(e) => setSeed(parseInt(e.target.value || "0", 10))}
          className="mb-5 w-40 rounded-lg border border-slate-300 px-3 py-2" />

        <div className="flex flex-wrap gap-3">
          <button onClick={start} className="rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white hover:bg-slate-700">
            Start career
          </button>
          <button onClick={() => { if (loadExisting()) nav("/season"); else alert("No saved game found."); }}
            className="rounded-xl border border-slate-300 px-5 py-2.5 font-semibold hover:bg-slate-100">
            Continue (autosave)
          </button>
          <label className="cursor-pointer rounded-xl border border-slate-300 px-5 py-2.5 font-semibold hover:bg-slate-100">
            Import save
            <input type="file" accept="application/json" className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) { try { importSave(await readFile(f)); nav("/season"); } catch { alert("Could not read save file."); } }
              }} />
          </label>
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Fully fictional: programs are named for their city/region and a color; athletes are procedurally generated.
      </p>
    </div>
  );
}
