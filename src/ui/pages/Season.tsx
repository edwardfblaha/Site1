import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../../state/store";
import { player, isRaceWeek, playerQualified } from "../../state/game";
import { aiLineup, projectedStrength, type TrainingBlock, type VolumeLevel, type RaceResult, type Program } from "../../engine";
import { FitnessChart } from "../components/FitnessChart";
import { Pill, fmtTime } from "../components/ui";

const BLOCKS: { id: TrainingBlock; name: string; desc: string }[] = [
  { id: "base", name: "Aerobic Base", desc: "Builds the aerobic ceiling. Low risk. Do it early." },
  { id: "longRun", name: "Long Run", desc: "Aerobic + durability. Low intensity." },
  { id: "threshold", name: "Lactate Threshold", desc: "Raises threshold & fade-resistance. Better with a lab." },
  { id: "vo2", name: "VO₂max / Intervals", desc: "Big sharpness gains, high fatigue & injury. Mid/late only." },
  { id: "raceSpecific", name: "Race-Specific", desc: "Sharpens for racing. Peaks late." },
  { id: "sharpening", name: "Sharpening", desc: "Final speed touch. Use just before champs." },
  { id: "taper", name: "Taper", desc: "Sheds fatigue, holds fitness. Taper into November." },
];

export function Season() {
  const save = useGame((s) => s.save)!;
  const train = useGame((s) => s.train);
  const race = useGame((s) => s.race);
  const lastResult = useGame((s) => s.lastResult);
  const nav = useNavigate();

  const p = player(save);
  const raceWeek = isRaceWeek(save.week);
  const [block, setBlock] = useState<TrainingBlock>("base");
  const [volume, setVolume] = useState<VolumeLevel>("high");
  const [hills, setHills] = useState(false);

  const healthy = useMemo(
    () => [...p.roster].filter((a) => a.status.kind === "healthy").sort((a, b) => projectedStrength(b) - projectedStrength(a)),
    [p.roster, save.week]
  );
  const [lineup, setLineup] = useState<string[]>(() => aiLineup(p, 7).map((a) => a.id));

  if (save.phase === "offseason") {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-lg font-bold">Season complete</h2>
        <p className="mt-1 text-slate-600">Head to the offseason to handle recruiting and your budget.</p>
        <button onClick={() => nav("/offseason")} className="mt-4 rounded-xl bg-amber-500 px-5 py-2.5 font-semibold text-slate-900">Go to offseason →</button>
      </div>
    );
  }

  const meetLabel =
    save.week === 12 ? "National Championship (10k)"
    : save.week === 11 ? "Regional Championship (10k) — top 2 auto-qualify"
    : save.week === 10 ? "Conference Championship (8k)"
    : raceWeek ? "Invitational (8k)" : null;

  function toggleLineup(id: string) {
    setLineup((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 7 ? [...cur, id] : cur);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black">Week {save.week}</h1>
          <p className="text-slate-500">{meetLabel ? `Race week — ${meetLabel}` : "Training week"}</p>
        </div>
        {save.week === 12 && <Pill tone={playerQualified(save) ? "green" : "red"}>{playerQualified(save) ? "Qualified for nationals" : "Did not qualify"}</Pill>}
      </div>

      {/* Training */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-bold">Training block {save.trainedThisWeek && <Pill tone="green">done this week</Pill>}</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {BLOCKS.map((b) => (
            <button key={b.id} disabled={save.trainedThisWeek} onClick={() => setBlock(b.id)}
              className={`rounded-xl border p-3 text-left ${block === b.id ? "border-slate-900 ring-2 ring-slate-900" : "border-slate-200"} ${save.trainedThisWeek ? "opacity-50" : "hover:border-slate-400"}`}>
              <div className="font-semibold">{b.name}</div>
              <div className="text-xs text-slate-500">{b.desc}</div>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1">
            {(["low", "med", "high"] as VolumeLevel[]).map((v) => (
              <button key={v} disabled={save.trainedThisWeek} onClick={() => setVolume(v)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${volume === v ? "bg-slate-900 text-white" : "bg-slate-100"}`}>
                {v === "med" ? "medium" : v} volume
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={hills} disabled={save.trainedThisWeek} onChange={(e) => setHills(e.target.checked)} />
            Hill emphasis (lower injury risk)
          </label>
          {!save.trainedThisWeek && (
            <button onClick={() => train({ block, volume, hillEmphasis: hills })}
              className="ml-auto rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white hover:bg-slate-700">
              Train week {!raceWeek && "& advance"}
            </button>
          )}
        </div>
      </section>

      {/* Race (only on race weeks, after training) */}
      {raceWeek && save.trainedThisWeek && !lastResult && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-1 text-lg font-bold">Set your lineup ({lineup.length}/7)</h2>
          <p className="mb-3 text-sm text-slate-500">Pick 5–7 runners. Rest anyone who needs it.</p>
          <div className="grid gap-1 sm:grid-cols-2">
            {healthy.map((a) => (
              <label key={a.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${lineup.includes(a.id) ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}>
                <input type="checkbox" checked={lineup.includes(a.id)} onChange={() => toggleLineup(a.id)} />
                <span className="font-medium">{a.firstName} {a.lastName}</span>
                <span className="text-slate-400">{a.classYear}</span>
                <span className="ml-auto text-slate-400">fresh {Math.round(100 - a.fitness.fatigue)}%</span>
              </label>
            ))}
          </div>
          <button disabled={lineup.length < 5} onClick={() => race(lineup)}
            className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-40">
            Run the race →
          </button>
          {save.week === 12 && !playerQualified(save) && (
            <p className="mt-2 text-sm text-rose-600">You didn't qualify — the race will run without your team.</p>
          )}
        </section>
      )}

      {lastResult && <ResultPanel result={lastResult} playerId={save.playerId} programs={save.programs} />}

      {/* Fitness chart */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-bold">Team fitness & freshness</h2>
        <FitnessChart points={save.fitnessHistory} />
      </section>
    </div>
  );
}

function ResultPanel({ result, playerId, programs }: { result: RaceResult; playerId: string; programs: Program[] }) {
  const nameById = new Map(programs.map((p) => [p.def.id, p.def]));
  const athName = (pid: string, aid: string) => {
    const prog = programs.find((x) => x.def.id === pid);
    const a = prog?.roster.find((x) => x.id === aid);
    return a ? `${a.firstName} ${a.lastName}` : aid;
  };
  const mine = result.runners.filter((r) => r.programId === playerId);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-3 text-lg font-bold">Result</h2>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Team scores</h3>
          <table className="w-full text-sm">
            <tbody>
              {result.teamScores.slice(0, 12).map((t) => {
                const def = nameById.get(t.programId);
                return (
                  <tr key={t.programId} className={`border-t border-slate-100 ${t.programId === playerId ? "font-bold" : ""}`}>
                    <td className="w-7 py-1 text-slate-400">{t.teamPlace}</td>
                    <td><span className="mr-2 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: def?.colorPrimary }} />{def?.name}</td>
                    <td className="text-right tabular-nums">{t.score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Your runners</h3>
          <div className="space-y-2">
            {mine.sort((a, b) => a.place - b.place).map((r) => (
              <div key={r.athleteId} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{r.place}. {athName(r.programId, r.athleteId)}</span>
                  <span className="tabular-nums">{fmtTime(r.timeSec)}</span>
                </div>
                {r.notes[0] && <div className="text-xs text-slate-500">{r.notes[0]}</div>}
              </div>
            ))}
            {!mine.length && <div className="text-sm text-slate-400">Your team didn't race.</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
