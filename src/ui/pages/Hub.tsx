import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useGame } from "../../state/store";
import { player, isRaceWeek, playerQualified, recommendedTraining, meetInfo, nationalRankings, type GameSave } from "../../state/game";
import { aiLineup, projectedStrength, type TrainingBlock, type VolumeLevel, type RaceResult, type Program } from "../../engine";
import { Crest, Avatar } from "../components/art";
import { OVR, Pill, fmtTime } from "../components/ui";
import { FitnessChart } from "../components/FitnessChart";

const BLOCKS: { id: TrainingBlock; name: string; icon: string; desc: string }[] = [
  { id: "base", name: "Aerobic Base", icon: "🫀", desc: "Builds the ceiling. Low risk." },
  { id: "longRun", name: "Long Run", icon: "🛣️", desc: "Aerobic + durability." },
  { id: "threshold", name: "Threshold", icon: "⚡", desc: "Raises threshold. Loves a lab." },
  { id: "vo2", name: "VO₂ / Intervals", icon: "🔥", desc: "Sharpness, high fatigue." },
  { id: "raceSpecific", name: "Race-Specific", icon: "🎯", desc: "Sharpen to race." },
  { id: "sharpening", name: "Sharpening", icon: "✨", desc: "Final speed touch." },
  { id: "taper", name: "Taper", icon: "🪶", desc: "Shed fatigue, stay sharp." },
];

export function Hub() {
  const save = useGame((s) => s.save)!;
  const train = useGame((s) => s.train);
  const race = useGame((s) => s.race);
  const lastResult = useGame((s) => s.lastResult);
  const nav = useNavigate();
  const p = player(save);

  const rec = recommendedTraining(save.week);
  const [block, setBlock] = useState<TrainingBlock>(rec.block);
  const [volume, setVolume] = useState<VolumeLevel>(rec.volume);
  const [hills, setHills] = useState(false);
  const healthy = useMemo(
    () => [...p.roster].filter((a) => a.status.kind === "healthy").sort((a, b) => projectedStrength(b) - projectedStrength(a)),
    [p.roster, save.week]
  );
  const [lineup, setLineup] = useState<string[]>(() => aiLineup(p, 7).map((a) => a.id));
  const toggle = (id: string) => setLineup((c) => c.includes(id) ? c.filter((x) => x !== id) : c.length < 7 ? [...c, id] : c);

  const rank = useMemo(() => nationalRankings(save).findIndex((r) => r.programId === save.playerId) + 1, [save]);
  const mi = meetInfo(save.week);
  const raceWeek = isRaceWeek(save.week);

  return (
    <div className="space-y-5">
      <Hero p={p} save={save} rank={rank} />

      {/* ---- PRIMARY GUIDED ACTION ---- */}
      {save.phase === "offseason" ? (
        <ActionCard icon="🏆" title="Season complete — enter the offseason"
          body="Review the year, handle an event, recruit, and set your budget." cta="Go to offseason"
          onClick={() => nav("/offseason")} />
      ) : lastResult ? (
        <ResultCard result={lastResult} save={save} onContinue={() => useGame.setState({ lastResult: null })} />
      ) : !save.trainedThisWeek ? (
        <section className="panel p-5">
          <StepHeader step={raceWeek ? "1 / 2" : "This week"} title={`Week ${save.week} — Training`} />
          <div className="mb-3 flex items-start gap-2 rounded-xl bg-[color:var(--accent)]/10 p-3 text-sm">
            <span>🧠</span><span><b className="text-[color:var(--accent)]">Coach's tip:</b> {rec.reason}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {BLOCKS.map((b) => {
              const isRec = b.id === rec.block;
              const sel = block === b.id;
              return (
                <button key={b.id} onClick={() => setBlock(b.id)}
                  className={`relative rounded-xl border p-3 text-left transition ${sel ? "border-[color:var(--accent)] bg-[color:var(--accent)]/10 ring-1 ring-[color:var(--accent)]" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}>
                  {isRec && <span className="absolute right-2 top-2 chip bg-[color:var(--accent)]/20 text-[color:var(--accent)]">rec</span>}
                  <div className="text-xl">{b.icon}</div>
                  <div className="mt-1 font-bold">{b.name}</div>
                  <div className="text-xs text-slate-400">{b.desc}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1">
              {(["low", "med", "high"] as VolumeLevel[]).map((v) => (
                <button key={v} onClick={() => setVolume(v)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${volume === v ? "bg-[color:var(--accent)] text-slate-950" : "text-slate-300"}`}>
                  {v === "med" ? "medium" : v}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={hills} onChange={(e) => setHills(e.target.checked)} /> Hill emphasis (safer)
            </label>
            <button className="btn-accent ml-auto" onClick={() => train({ block, volume, hillEmphasis: hills })}>
              {raceWeek ? "Train →" : "Train & advance week →"}
            </button>
          </div>
        </section>
      ) : raceWeek ? (
        <section className="panel p-5">
          <StepHeader step="2 / 2" title={`Race day — ${mi?.label} (${mi?.dist})`} />
          {save.week === 12 && (
            <div className="mb-3"><Pill tone={playerQualified(save) ? "green" : "red"}>
              {playerQualified(save) ? "You qualified for nationals" : "You did not qualify — the race runs without you"}</Pill></div>
          )}
          <p className="mb-3 text-sm text-slate-400">Pick 5–7 runners ({lineup.length} selected). Tap a card to toggle.</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {healthy.map((a) => {
              const sel = lineup.includes(a.id);
              return (
                <button key={a.id} onClick={() => toggle(a.id)}
                  className={`flex items-center gap-3 rounded-xl border p-2.5 text-left ${sel ? "border-[color:var(--accent)] bg-[color:var(--accent)]/10" : "border-white/10 bg-white/[0.03]"}`}>
                  <Avatar name={`${a.firstName} ${a.lastName}`} color={p.def.colorPrimary} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{a.firstName} {a.lastName}</div>
                    <div className="text-xs text-slate-400">{a.classYear} · fresh {Math.round(100 - a.fitness.fatigue)}%</div>
                  </div>
                  <OVR value={ovrOf(a)} size="sm" />
                </button>
              );
            })}
          </div>
          <button className="btn-accent mt-4" disabled={lineup.length < 5 && playerQualified(save)} onClick={() => race(lineup)}>
            Run the race →
          </button>
        </section>
      ) : null}

      {/* ---- SEASON PROGRESS ---- */}
      <SeasonStrip week={save.week} phase={save.phase} />

      {/* ---- FITNESS CHART ---- */}
      {save.fitnessHistory.length > 1 && (
        <section className="panel p-5">
          <h2 className="mb-3 text-lg font-black">Team fitness & freshness</h2>
          <FitnessChart points={save.fitnessHistory} />
        </section>
      )}

      {/* ---- QUICK NAV CARDS ---- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NavCard to="/roster" icon="👥" title="Roster" sub={`${p.roster.length}/18 · avg OVR ${avgOvr(p)}`} />
        <NavCard to="/rankings" icon="📊" title="Rankings" sub={`You are #${rank}`} />
        <NavCard to="/recruiting" icon="🎓" title="Recruiting" sub={save.phase === "offseason" ? "Open now" : "Opens in offseason"} />
        <NavCard to="/budget" icon="💰" title="Budget" sub={`Ops $${p.budget.operationsPot}k`} />
      </div>
    </div>
  );
}

function Hero({ p, save, rank }: { p: Program; save: GameSave; rank: number }) {
  return (
    <div className="panel relative overflow-hidden p-5"
      style={{ background: `linear-gradient(110deg, ${p.def.colorPrimary}22, transparent 60%)` }}>
      <div className="flex items-center gap-4">
        <Crest name={p.def.name} color={p.def.colorPrimary} size={64} />
        <div className="flex-1">
          <div className="text-2xl font-black leading-tight">{p.def.name}</div>
          <div className="text-sm text-slate-400">{save.year} season · {save.phase === "offseason" ? "Offseason" : `Week ${save.week}`} · #{rank} nationally</div>
        </div>
        <div className="hidden gap-2 sm:flex">
          <MiniStat label="Prestige" v={p.prestige} />
          <MiniStat label="Coach rep" v={p.coach.reputation} />
        </div>
      </div>
    </div>
  );
}
const MiniStat = ({ label, v }: { label: string; v: number }) => (
  <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
    <div className="text-xl font-black tabular-nums">{v}</div>
    <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
  </div>
);

function StepHeader({ step, title }: { step: string; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="chip bg-white/10 text-slate-300">{step}</span>
      <h2 className="text-lg font-black">{title}</h2>
    </div>
  );
}

function ActionCard({ icon, title, body, cta, onClick }: { icon: string; title: string; body: string; cta: string; onClick: () => void }) {
  return (
    <section className="panel flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center">
      <div className="text-4xl">{icon}</div>
      <div className="flex-1"><h2 className="text-xl font-black">{title}</h2><p className="text-slate-400">{body}</p></div>
      <button className="btn-accent" onClick={onClick}>{cta} →</button>
    </section>
  );
}

function NavCard({ to, icon, title, sub }: { to: string; icon: string; title: string; sub: string }) {
  return (
    <Link to={to} className="panel p-4 transition hover:border-white/25 hover:bg-white/[0.07]">
      <div className="text-2xl">{icon}</div>
      <div className="mt-2 font-black">{title}</div>
      <div className="text-xs text-slate-400">{sub}</div>
    </Link>
  );
}

function SeasonStrip({ week, phase }: { week: number; phase: string }) {
  const weeks = Array.from({ length: 12 }, (_, i) => i + 1);
  const label = (w: number) => (w === 12 ? "NAT" : w === 11 ? "REG" : w === 10 ? "CONF" : (w === 4 || w === 6 || w === 8) ? "INV" : "");
  return (
    <div className="panel flex items-center gap-1 overflow-x-auto p-3">
      {weeks.map((w) => {
        const done = phase === "offseason" || w < week;
        const cur = phase !== "offseason" && w === week;
        return (
          <div key={w} className={`flex min-w-[52px] flex-1 flex-col items-center rounded-lg px-1 py-1.5 text-center ${cur ? "bg-[color:var(--accent)] text-slate-950" : done ? "bg-white/10 text-slate-300" : "bg-white/[0.03] text-slate-500"}`}>
            <span className="text-[10px] font-bold">W{w}</span>
            <span className="text-[9px] font-bold tracking-wide opacity-80">{label(w) || "·"}</span>
          </div>
        );
      })}
      <div className={`flex min-w-[52px] flex-col items-center rounded-lg px-1 py-1.5 ${phase === "offseason" ? "bg-amber-400 text-slate-950" : "bg-white/[0.03] text-slate-500"}`}>
        <span className="text-[10px] font-bold">OFF</span><span className="text-[9px] opacity-80">·</span>
      </div>
    </div>
  );
}

function ResultCard({ result, save, onContinue }: { result: RaceResult; save: GameSave; onContinue: () => void }) {
  const programs = save.programs;
  const nameById = new Map(programs.map((p) => [p.def.id, p.def]));
  const mine = result.runners.filter((r) => r.programId === save.playerId).sort((a, b) => a.place - b.place);
  const myTeam = result.teamScores.find((t) => t.programId === save.playerId);
  const athName = (aid: string) => {
    const a = programs.find((x) => x.def.id === save.playerId)?.roster.find((x) => x.id === aid);
    return a ? `${a.firstName} ${a.lastName}` : aid;
  };
  return (
    <section className="panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <StepHeader step="Result" title={myTeam ? `You placed ${ordinal(myTeam.teamPlace)}` : "Race complete"} />
        <button className="btn-accent" onClick={onContinue}>Continue →</button>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Team scores</h3>
          <div className="space-y-1">
            {result.teamScores.slice(0, 10).map((t) => {
              const def = nameById.get(t.programId)!;
              return (
                <div key={t.programId} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${t.programId === save.playerId ? "bg-[color:var(--accent)]/15 font-bold" : "bg-white/[0.03]"}`}>
                  <span className="w-5 text-slate-400">{t.teamPlace}</span>
                  <Crest name={def.name} color={def.colorPrimary} size={20} />
                  <span className="flex-1 truncate">{def.name}</span>
                  <span className="tabular-nums text-slate-300">{t.score}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Your runners</h3>
          <div className="space-y-1.5">
            {mine.map((r) => (
              <div key={r.athleteId} className="rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
                <div className="flex justify-between"><span className="font-semibold">{r.place}. {athName(r.athleteId)}</span><span className="tabular-nums">{fmtTime(r.timeSec)}</span></div>
                {r.notes[0] && <div className="text-xs text-slate-400">{r.notes[0]}</div>}
              </div>
            ))}
            {!mine.length && <div className="text-sm text-slate-500">Your team didn't race.</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

function ovrOf(a: { attrs: { aerobic: number; threshold: number; speed: number; hills: number } }): number {
  return Math.round((a.attrs.aerobic + a.attrs.threshold + a.attrs.speed + a.attrs.hills) / 4);
}
function avgOvr(p: Program): number {
  if (!p.roster.length) return 0;
  return Math.round(p.roster.reduce((s, a) => s + ovrOf(a), 0) / p.roster.length);
}
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
