import { useGame } from "../../state/store";
import { player } from "../../state/game";
import type { Budget } from "../../engine";

const FIELDS: { key: keyof Budget; label: string; hint: string }[] = [
  { key: "nilPool", label: "NIL pool ($k)", hint: "Retention + recruiting pull, esp. international." },
  { key: "domesticRecruiting", label: "Domestic recruiting ($k)", hint: "Sign odds for HS & transfers." },
  { key: "internationalRecruiting", label: "International recruiting ($k)", hint: "Access to older, developed runners." },
  { key: "media", label: "Media / branding ($k)", hint: "Raises recruit interest across the board." },
  { key: "summerCamp", label: "Summer camp ($k)", hint: "Offseason fitness development boost." },
  { key: "operationsPot", label: "Operations pot ($k)", hint: "In-season spend: gels, medical, shoe replacement, events." },
  { key: "officialVisits", label: "Official visits (slots)", hint: "Each visit lifts sign odds." },
];

export function BudgetPage() {
  const save = useGame((s) => s.save)!;
  const patch = useGame((s) => s.patchBudget);
  const p = player(save);
  const b = p.budget;

  const set = (key: keyof Budget, v: number) => patch({ [key]: Math.max(0, v) } as Partial<Budget>);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-black">Budget & investments</h1>
        <div className="text-sm text-slate-500">Prestige {p.prestige} · higher prestige & results → bigger budgets</div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-bold">Allocations</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{f.label}</label>
              <input type="number" value={b[f.key] as number} onChange={(e) => set(f.key, parseInt(e.target.value || "0", 10))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              <p className="mt-0.5 text-xs text-slate-400">{f.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-bold">Investments & kit</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Carbon-plate shoe tier (0–3)</label>
            <input type="number" min={0} max={3} value={b.investments.shoeTier}
              onChange={(e) => patch({ investments: { ...b.investments, shoeTier: Math.max(0, Math.min(3, +e.target.value)) as 0 | 1 | 2 | 3, shoeLifeRacesLeft: 6 } })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            <p className="mt-0.5 text-xs text-slate-400">Flat/firm courses benefit most. Shoes wear out and need replacing.</p>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lactate lab</label>
            <button onClick={() => patch({ investments: { ...b.investments, lab: !b.investments.lab } })}
              className={`mt-1 block w-full rounded-lg px-3 py-2 font-semibold ${b.investments.lab ? "bg-emerald-600 text-white" : "bg-slate-100"}`}>
              {b.investments.lab ? "Lab: ON — precise threshold work" : "Lab: OFF"}
            </button>
            <p className="mt-0.5 text-xs text-slate-400">Precise threshold training (fewer mis-dosed sessions).</p>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Gels in stock
              <input type="number" value={b.consumables.gels} onChange={(e) => patch({ consumables: { ...b.consumables, gels: Math.max(0, +e.target.value) } })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="flex-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Medical supplies
              <input type="number" value={b.consumables.medical} onChange={(e) => patch({ consumables: { ...b.consumables, medical: Math.max(0, +e.target.value) } })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}
