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
    return <div className="rounded-2xl border border-slate-200 bg-white p-6">The season is in progress — head to <button className="font-semibold underline" onClick={() => nav("/season")}>Season</button>.</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black">Offseason — {save.year}</h1>

      {sum && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-bold">Season review</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="National finish" value={sum.playerFinish ? `#${sum.playerFinish}` : "DNQ"} />
            <Stat label="Expectation" value={sum.expectation >= 99 ? "Regionals" : `Top ${sum.expectation}`} />
            <Stat label="Coach rep" value={`${sum.repDelta >= 0 ? "+" : ""}${sum.repDelta}`} color={sum.repDelta >= 0 ? "#059669" : "#e11d48"} />
            <Stat label="Prestige" value={`${sum.prestigeDelta >= 0 ? "+" : ""}${sum.prestigeDelta}`} color={sum.prestigeDelta >= 0 ? "#059669" : "#e11d48"} />
          </div>
          <p className="mt-3 text-sm text-slate-600">
            National champion: <span className="font-semibold">{sum.championName}</span>.{" "}
            {sum.metExpectation ? "You met the athletic director's expectations." : "You fell short of expectations — another year like this risks your job."}
          </p>
          {sum.offers.length > 0 && (
            <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm">
              <span className="font-semibold">Job interest:</span>{" "}
              {sum.offers.map((o) => `${o.programName} (prestige ${o.prestige})`).join(", ")} are watching you.{" "}
              <span className="text-slate-500">(Switching programs comes in a later update — for now, keep building.)</span>
            </div>
          )}
        </section>
      )}

      {ev && (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6">
          <div className="mb-1 flex items-center gap-2"><Pill tone="blue">Event</Pill><h2 className="text-lg font-bold">{ev.title}</h2></div>
          <p className="mb-4 text-slate-700">{ev.body}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {ev.choices.map((c, i) => (
              <button key={i} onClick={() => resolveEvent(i)}
                className="rounded-xl border border-indigo-300 bg-white p-3 text-left hover:border-indigo-500">
                <div className="font-semibold">{c.label}</div>
                <div className="text-xs text-slate-500">{c.detail}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-2 text-lg font-bold">To-do before next season</h2>
        <ul className="mb-4 list-inside list-disc text-sm text-slate-600">
          <li>Recruit — sign up to 6 athletes on the <button className="font-semibold underline" onClick={() => nav("/recruiting")}>recruiting board</button>.</li>
          <li>Set your <button className="font-semibold underline" onClick={() => nav("/budget")}>budget & investments</button> for next year.</li>
          <li>Resolve any events above.</li>
        </ul>
        <button disabled={!!ev} onClick={() => { nextSeason(); nav("/season"); }}
          className="rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white hover:bg-slate-700 disabled:opacity-40">
          {ev ? "Resolve the event first" : "Start next season →"}
        </button>
        <p className="mt-2 text-xs text-slate-400">Other programs will recruit and develop their rosters when you advance. Current roster: {p.roster.length}/18.</p>
      </section>
    </div>
  );
}
