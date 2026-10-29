import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useGame } from "../state/store";
import { player } from "../state/game";
import { exportSave } from "../state/save";
import { Crest } from "./components/art";

const NAV: [string, string, string][] = [
  ["/hub", "Hub", "🏠"],
  ["/roster", "Roster", "👥"],
  ["/rankings", "Rankings", "📊"],
  ["/recruiting", "Recruiting", "🎓"],
  ["/budget", "Budget", "💰"],
];

export function Layout() {
  const save = useGame((s) => s.save);
  const quit = useGame((s) => s.quitToMenu);
  const nav = useNavigate();
  if (!save) return <Outlet />;
  const p = player(save);
  const accent = p.def.colorPrimary;

  return (
    <div className="flex min-h-screen" style={{ ["--accent" as string]: accent, ["--accent2" as string]: accent }}>
      <aside className="flex w-56 shrink-0 flex-col border-r border-white/10 bg-black/40 backdrop-blur">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <Crest name={p.def.name} color={p.def.colorPrimary} size={40} />
          <div className="min-w-0">
            <div className="truncate text-sm font-black leading-tight">{p.def.name}</div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">XC Manager</div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-1">
          {NAV.map(([to, label, icon]) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold ${isActive ? "bg-[color:var(--accent)]/20 text-white" : "text-slate-300 hover:bg-white/5"}`}>
              <span>{icon}</span>{label}
            </NavLink>
          ))}
          {save.phase === "offseason" && (
            <NavLink to="/offseason"
              className={({ isActive }) =>
                `mt-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold ${isActive ? "bg-amber-400 text-slate-950" : "bg-amber-400/90 text-slate-950 hover:bg-amber-300"}`}>
              <span>🏆</span>Offseason
            </NavLink>
          )}
        </nav>
        <div className="space-y-1 px-2 pb-3 text-xs">
          <button onClick={() => exportSave(save)} className="w-full rounded-lg px-3 py-2 text-left text-slate-400 hover:bg-white/5">Export save</button>
          <button onClick={() => { if (confirm("Quit to menu? Your autosave is kept.")) { quit(); nav("/"); } }}
            className="w-full rounded-lg px-3 py-2 text-left text-slate-500 hover:bg-white/5">Quit to menu</button>
        </div>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-white/10 bg-black/30 px-6 py-3 text-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: accent }} />
            <span className="font-bold">{p.def.name}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">{save.year}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">{save.phase === "offseason" ? "Offseason" : `Week ${save.week}`}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>Prestige {p.prestige}</span><span>Rep {p.coach.reputation}</span><span>Ops ${p.budget.operationsPot}k</span>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-5 py-6"><Outlet /></main>
      </div>
    </div>
  );
}
