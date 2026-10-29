import { useGame } from "../../state/store";
import { player } from "../../state/game";
import type { Budget } from "../../engine";

const FIELDS: { key: keyof Budget; label: string; hint: string }[] = [
  { key: "nilPool", label: "NIL pool ($k)", hint: "Retention + recruiting pull." },
  { key: "domesticRecruiting", label: "Domestic recruiting ($k)", hint: "HS & transfer sign odds." },
  { key: "internationalRecruiting", label: "International recruiting ($k)", hint: "Older, developed runners." },
  { key: "media", label: "Media / branding ($k)", hint: "Raises recruit interest." },
  { key: "summerCamp", label: "Summer camp ($k)", hint: "Offseason development boost." },
  { key: "operationsPot", label: "Operations pot ($k)", hint: "Gels, medical, shoe replacement, events." },
  { key: "officialVisits", label: "Official visits (slots)", hint: "Each visit lifts sign odds." },
];

export function BudgetPage() {
  const save = useGame((s) => s.save)!;
  const patch = useGame((s) => s.patchBudget);
  const p = player(save);
  const b = p.budget;
  const set = (key: keyof Budget, v: number) => patch({ [key]: Math.max(0, v) } as Partial<Budget>);
  const inputCls = "mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-slate-100";
  const labCls = "text-[11px] font-semibold uppercase tracking-wide text-slate-400";

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-black">Budget & investments</h1>
        <div className="text-xs text-slate-500">Prestige {p.prestige} · bigger budgets follow prestige & results</div>
      </div>

      <section className="panel p-5">
        <h2 className="mb-3 text-lg font-black">Allocations</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className={labCls}>{f.label}</label>
              <input type="number" value={b[f.key] as number} onChange={(e) => set(f.key, parseInt(e.target.value || "0", 10))} className={inputCls} />
              <p className="mt-0.5 text-xs text-slate-500">{f.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="mb-3 text-lg font-black">Investments & kit</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labCls}>Carbon-plate shoe tier (0–3)</label>
            <input type="number" min={0} max={3} value={b.investments.shoeTier}
              onChange={(e) => patch({ investments: { ...b.investments, shoeTier: Math.max(0, Math.min(3, +e.target.value)) as 0 | 1 | 2 | 3, shoeLifeRacesLeft: 6 } })} className={inputCls} />
            <p className="mt-0.5 text-xs text-slate-500">Flat/firm courses benefit most; shoes wear out.</p>
          </div>
          <div>
            <label className={labCls}>Lactate lab</label>
            <button onClick={() => patch({ investments: { ...b.investments, lab: !b.investments.lab } })}
              className={`mt-1 block w-full rounded-lg px-3 py-2 font-bold ${b.investments.lab ? "bg-emerald-500 text-slate-950" : "bg-white/10 text-slate-200"}`}>
              {b.investments.lab ? "Lab: ON — precise threshold work" : "Lab: OFF"}
            </button>
            <p className="mt-0.5 text-xs text-slate-500">Fewer mis-dosed threshold sessions.</p>
          </div>
          <label className={labCls}>Gels in stock
            <input type="number" value={b.consumables.gels} onChange={(e) => patch({ consumables: { ...b.consumables, gels: Math.max(0, +e.target.value) } })} className={inputCls} />
          </label>
          <label className={labCls}>Medical supplies
            <input type="number" value={b.consumables.medical} onChange={(e) => patch({ consumables: { ...b.consumables, medical: Math.max(0, +e.target.value) } })} className={inputCls} />
          </label>
        </div>
      </section>
    </div>
  );
}
