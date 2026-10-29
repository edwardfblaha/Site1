import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useGame } from "../state/store";
import { player } from "../state/game";
import { exportSave } from "../state/save";

const NAV = [
  ["/season", "Season"],
  ["/roster", "Roster"],
  ["/rankings", "Rankings"],
  ["/recruiting", "Recruiting"],
  ["/budget", "Budget"],
];

export function Layout() {
  const save = useGame((s) => s.save);
  const quit = useGame((s) => s.quitToMenu);
  const nav = useNavigate();
  if (!save) return <Outlet />;
  const p = player(save);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-slate-900 text-slate-100">
        <div className="flex items-center gap-2 px-4 py-4">
          <span className="h-6 w-6 rounded" style={{ background: p.def.colorPrimary }} />
          <div>
            <div className="text-sm font-black leading-tight">{p.def.name}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">XC Manager</div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-2">
          {NAV.map(([to, label]) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800"}`}>
              {label}
            </NavLink>
          ))}
          {save.phase === "offseason" && (
            <NavLink to="/offseason"
              className={({ isActive }) =>
                `mt-1 block rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? "bg-amber-500 text-slate-900" : "bg-amber-400/90 text-slate-900 hover:bg-amber-300"}`}>
              Offseason ●
            </NavLink>
          )}
        </nav>
        <div className="space-y-1 px-2 pb-3 text-xs">
          <button onClick={() => exportSave(save)} className="w-full rounded-lg px-3 py-2 text-left text-slate-300 hover:bg-slate-800">Export save</button>
          <button onClick={() => { if (confirm("Quit to menu? Your autosave is kept.")) { quit(); nav("/"); } }}
            className="w-full rounded-lg px-3 py-2 text-left text-slate-400 hover:bg-slate-800">Quit to menu</button>
        </div>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-bold">{p.def.name}</span>
            <span className="text-slate-400">·</span>
            <span>{save.year} season</span>
            <span className="text-slate-400">·</span>
            <span>{save.phase === "offseason" ? "Offseason" : `Week ${save.week}`}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>Prestige {p.prestige}</span>
            <span>Coach rep {p.coach.reputation}</span>
            <span>Ops ${p.budget.operationsPot}k</span>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-6"><Outlet /></main>
      </div>
    </div>
  );
}
