import { useNavigate } from "react-router-dom";
import { useGame } from "../../state/store";
import { player, currentEvent } from "../../state/game";
import { Stat, Pill } from "../components/ui";

export function Offseason() {
  const save = useGame((s) => s.save)!;
  const resolveEvent = useGame((s) => s.resolveEvent);
  const nextSeason = useGame((s) => s.nextSeason);
  const nav = useNavigate();
  const p = player(save);
  const sum = save.lastSummary;
  const ev = currentEvent(save);

  if (save.phase !== "offseason") {
    return <div className="panel p-6">The season is in progress — head to the <button className="font-bold text-[color:var(--accent)]" onClick={() => nav("/hub")}>Hub</button>.</div>;
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">Offseason · {save.year}</h1>

      {sum && (
        <section className="panel p-5">
          <h2 className="mb-3 text-lg font-black">Season review</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="National finish" value={sum.playerFinish ? `#${sum.playerFinish}` : "DNQ"} />
            <Stat label="Expectation" value={sum.expectation >= 99 ? "Regionals" : `Top ${sum.expectation}`} />
            <Stat label="Coach rep" value={`${sum.repDelta >= 0 ? "+" : ""}${sum.repDelta}`} color={sum.repDelta >= 0 ? "#22c55e" : "#f43f5e"} />
            <Stat label="Prestige" value={`${sum.prestigeDelta >= 0 ? "+" : ""}${sum.prestigeDelta}`} color={sum.prestigeDelta >= 0 ? "#22c55e" : "#f43f5e"} />
          </div>
          <p className="mt-3 text-sm text-slate-300">
            National champion: <span className="font-bold">{sum.championName}</span>.{" "}
            {sum.metExpectation ? "You met the athletic director's expectations." : "You fell short — another year like this risks your job."}
          </p>
          {sum.offers.length > 0 && (
            <div className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-sm">
              <span className="font-bold text-emerald-300">Job interest:</span>{" "}
              {sum.offers.map((o) => `${o.programName} (${o.prestige})`).join(", ")} are watching you.
            </div>
          )}
        </section>
      )}

      {ev && (
        <section className="panel border-indigo-400/30 p-5" style={{ background: "rgba(99,102,241,.08)" }}>
          <div className="mb-1 flex items-center gap-2"><Pill tone="blue">Event</Pill><h2 className="text-lg font-black">{ev.title}</h2></div>
          <p className="mb-4 text-slate-300">{ev.body}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {ev.choices.map((c, i) => (
              <button key={i} onClick={() => resolveEvent(i)} className="rounded-xl border border-white/15 bg-white/5 p-3 text-left hover:border-[color:var(--accent)]">
                <div className="font-bold">{c.label}</div>
                <div className="text-xs text-slate-400">{c.detail}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="panel p-5">
        <h2 className="mb-2 text-lg font-black">Before next season</h2>
        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          <button onClick={() => nav("/recruiting")} className="btn-ghost text-left"><b>🎓 Recruit</b><div className="text-xs text-slate-400">Sign up to 6 athletes</div></button>
          <button onClick={() => nav("/budget")} className="btn-ghost text-left"><b>💰 Budget</b><div className="text-xs text-slate-400">Set spend & investments</div></button>
          <button onClick={() => nav("/roster")} className="btn-ghost text-left"><b>👥 Roster</b><div className="text-xs text-slate-400">Review your team</div></button>
        </div>
        <button disabled={!!ev} onClick={() => { nextSeason(); nav("/hub"); }} className="btn-accent disabled:opacity-40">
          {ev ? "Resolve the event first" : "Start next season →"}
        </button>
        <p className="mt-2 text-xs text-slate-500">Rivals recruit and develop when you advance. Roster: {p.roster.length}/18.</p>
      </section>
    </div>
  );
}
