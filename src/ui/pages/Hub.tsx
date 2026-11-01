import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../../state/store";
import { player, isRaceWeek, playerQualified, recommendedTraining, meetInfo, nationalRankings, type GameSave } from "../../state/game";
import { aiLineup, projectedStrength, previewTraining, type TrainingBlock, type VolumeLevel, type RaceResult, type Program, type TrainingPreview } from "../../engine";
import { Crest, Avatar } from "../components/art";
import { Icon } from "../components/Icon";
import { OVR, fmtTime } from "../components/ui";
import { FitnessChart } from "../components/FitnessChart";

const BLOCK_META: Record<TrainingBlock, { name: string; icon: string; desc: string }> = {
  base: { name: "Aerobic Base", icon: "pulse", desc: "Builds the aerobic ceiling. Low injury risk." },
  longRun: { name: "Long Run", icon: "pulse", desc: "Aerobic volume + durability." },
  threshold: { name: "Lactate Threshold", icon: "flask", desc: "Raises threshold; sharper with a lab." },
  vo2: { name: "VO₂ / Intervals", icon: "target", desc: "Big sharpness gains, high fatigue." },
  raceSpecific: { name: "Race-Specific", icon: "target", desc: "Sharpen for championship racing." },
  sharpening: { name: "Sharpening", icon: "target", desc: "Final speed touch before champs." },
  taper: { name: "Taper", icon: "check", desc: "Shed fatigue, hold fitness." },
};
const ALL_BLOCKS = Object.keys(BLOCK_META) as TrainingBlock[];

const ovrOf = (a: { attrs: { aerobic: number; threshold: number; speed: number; hills: number } }) =>
  Math.round((a.attrs.aerobic + a.attrs.threshold + a.attrs.speed + a.attrs.hills) / 4);
const avgOvr = (p: Program) => (p.roster.length ? Math.round(p.roster.reduce((s, a) => s + ovrOf(a), 0) / p.roster.length) : 0);

export function Hub() {
  const save = useGame((s) => s.save)!;
  const p = player(save);
  const rank = useMemo(() => nationalRankings(save).findIndex((r) => r.programId === save.playerId) + 1, [save]);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        <Hero p={p} save={save} rank={rank} />
        <Stepper week={save.week} phase={save.phase} />
        <FocusCard save={save} p={p} />
        {save.fitnessHistory.length > 1 && (
          <section className="panel p-5">
            <SectionTitle eyebrow="Conditioning" title="Team fitness & freshness" />
            <FitnessChart points={save.fitnessHistory} />
          </section>
        )}
      </div>
      <aside className="space-y-5">
        <Standings save={save} rank={rank} />
        <NewsFeed log={save.log} />
        <QuickFacts p={p} rank={rank} avg={avgOvr(p)} />
      </aside>
    </div>
  );
}

/* ---------------- the guided focus card (one decision at a time) ---------------- */
function FocusCard({ save, p }: { save: GameSave; p: Program }) {
  const train = useGame((s) => s.train);
  const race = useGame((s) => s.race);
  const lastResult = useGame((s) => s.lastResult);
  const nav = useNavigate();

  const rec = recommendedTraining(save.week);
  const [adjust, setAdjust] = useState(false);
  const [block, setBlock] = useState<TrainingBlock>(rec.block);
  const [volume, setVolume] = useState<VolumeLevel>(rec.volume);
  const [hills, setHills] = useState(false);

  const healthy = useMemo(
    () => [...p.roster].filter((a) => a.status.kind === "healthy").sort((a, b) => projectedStrength(b) - projectedStrength(a)),
    [p.roster, save.week]
  );
  const [adjustLineup, setAdjustLineup] = useState(false);
  const [lineup, setLineup] = useState<string[]>(() => aiLineup(p, 7).map((a) => a.id));
  const toggle = (id: string) => setLineup((c) => c.includes(id) ? c.filter((x) => x !== id) : c.length < 7 ? [...c, id] : c);

  const raceWeek = isRaceWeek(save.week);
  const mi = meetInfo(save.week);

  if (save.phase === "offseason") {
    return (
      <FocusShell eyebrow="Season complete" title="The offseason has arrived"
        body="Review your season, handle any situations with your athletes, recruit the next class, and set your budget.">
        <button className="btn-accent inline-flex items-center gap-2" onClick={() => nav("/offseason")}>Enter the offseason <Icon name="arrow" size={18} /></button>
      </FocusShell>
    );
  }

  if (lastResult) {
    return <ResultCard result={lastResult} save={save} onContinue={() => useGame.setState({ lastResult: null })} />;
  }

  if (!save.trainedThisWeek) {
    const meta = BLOCK_META[block];
    const preview = previewTraining(p, { block, volume, hillEmphasis: hills });
    return (
      <FocusShell eyebrow={raceWeek ? "Decision 1 of 2 · Week " + save.week : "Week " + save.week}
        title="Set this week's training" body={rec.reason}>
        {/* recommended plan — one-click accept */}
        <div className="rounded-xl border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 p-4">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-[color:var(--accent)]/20 p-2 text-[color:var(--accent)]"><Icon name={meta.icon} /></span>
            <div className="flex-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--accent)]">{block === rec.block ? "Recommended" : "Selected"}</div>
              <div className="font-bold">{meta.name} · {volume === "med" ? "medium" : volume} volume{hills ? " · hills" : ""}</div>
              <div className="text-xs text-slate-400">{meta.desc}</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button className="btn-accent inline-flex items-center gap-2" onClick={() => train({ block, volume, hillEmphasis: hills })}>
              {raceWeek ? "Confirm training" : "Train & advance"} <Icon name="arrow" size={18} />
            </button>
            <button className="btn-ghost" onClick={() => setAdjust((v) => !v)}>{adjust ? "Hide options" : "Adjust plan"}</button>
          </div>
        </div>

        <TrainingPreviewPanel preview={preview} />

        {adjust && (
          <div className="mt-3 space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {ALL_BLOCKS.map((b) => {
                const m = BLOCK_META[b]; const sel = block === b;
                return (
                  <button key={b} onClick={() => setBlock(b)}
                    className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left ${sel ? "border-[color:var(--accent)] bg-white/[0.06]" : "border-white/10 hover:border-white/25"}`}>
                    <span className="mt-0.5 text-slate-300"><Icon name={m.icon} size={18} /></span>
                    <span><span className="block text-sm font-semibold">{m.name}{b === rec.block ? " · rec" : ""}</span>
                      <span className="block text-xs text-slate-400">{m.desc}</span></span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex gap-1 rounded-lg bg-white/5 p-1">
                {(["low", "med", "high"] as VolumeLevel[]).map((v) => (
                  <button key={v} onClick={() => setVolume(v)} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${volume === v ? "bg-[color:var(--accent)] text-slate-950" : "text-slate-300"}`}>{v === "med" ? "medium" : v}</button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={hills} onChange={(e) => setHills(e.target.checked)} /> Hill emphasis (safer)</label>
            </div>
          </div>
        )}
      </FocusShell>
    );
  }

  // trained, and it's a race week → set lineup & race
  if (raceWeek) {
    const qualifiedOut = save.week === 12 && !playerQualified(save);
    return (
      <FocusShell eyebrow={`Decision 2 of 2 · Week ${save.week}`} title={`Race day — ${mi?.label} (${mi?.dist})`} body={mi?.sub ?? ""}>
        {qualifiedOut ? (
          <div className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-300">
            Your team did not qualify for nationals. Advance to watch the championship play out.
            <div className="mt-3"><button className="btn-accent" onClick={() => race([])}>Advance <Icon name="arrow" size={18} className="inline" /></button></div>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-slate-400">Lineup ({lineup.length}/7) — recommended top 7 selected</span>
              <button className="text-sm font-semibold text-[color:var(--accent)]" onClick={() => setAdjustLineup((v) => !v)}>{adjustLineup ? "Done" : "Adjust lineup"}</button>
            </div>
            {adjustLineup && (
              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                {healthy.map((a) => {
                  const sel = lineup.includes(a.id);
                  return (
                    <button key={a.id} onClick={() => toggle(a.id)} className={`flex items-center gap-2.5 rounded-lg border p-2 text-left ${sel ? "border-[color:var(--accent)] bg-white/[0.06]" : "border-white/10"}`}>
                      <Avatar name={`${a.firstName} ${a.lastName}`} color={p.def.colorPrimary} size={30} />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{a.firstName} {a.lastName}</span>
                      <span className="text-xs text-slate-400">fresh {Math.round(100 - a.fitness.fatigue)}%</span>
                      <OVR value={ovrOf(a)} size="sm" />
                    </button>
                  );
                })}
              </div>
            )}
            <button className="btn-accent inline-flex items-center gap-2" disabled={lineup.length < 5} onClick={() => race(lineup)}>
              Run the race <Icon name="flag" size={18} />
            </button>
          </>
        )}
      </FocusShell>
    );
  }
  return null;
}

/* ---------------- building blocks ---------------- */
function FocusShell({ eyebrow, title, body, children }: { eyebrow: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <section className="panel p-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-[color:var(--accent)]">{eyebrow}</div>
      <h2 className="mt-1 text-xl font-black">{title}</h2>
      {body && <p className="mb-4 mt-1 max-w-xl text-sm text-slate-400">{body}</p>}
      {children}
    </section>
  );
}

/* ---- live projection of a training choice (the heart of the decision) ---- */
const SYS_META: { key: keyof TrainingPreview["after"]; label: string }[] = [
  { key: "aerobicBase", label: "Aerobic" },
  { key: "lactate", label: "Threshold" },
  { key: "vo2", label: "VO₂" },
  { key: "sharpness", label: "Sharpness" },
];
function riskColor(pct: number): string {
  if (pct < 10) return "#22c55e";
  if (pct < 25) return "#f59e0b";
  return "#f43f5e";
}
function TrainingPreviewPanel({ preview: pv }: { preview: TrainingPreview }) {
  if (!pv.healthyCount) {
    return <div className="mt-3 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300">No healthy athletes to train this week.</div>;
  }
  const injPct = Math.round(pv.teamInjuryRisk * 100);
  const freshAfter = Math.round(pv.freshnessAfter);
  const freshBefore = Math.round(100 - pv.fatigueBefore);
  const champ = Math.round(pv.champPrepAfter * 100);
  const topRisk = pv.atRisk.filter((a) => Math.max(a.injuryRisk, a.overtrainRisk) > 0.06).slice(0, 2);

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
        Projected effect · {pv.healthyCount} healthy
      </div>

      {/* four fitness systems with projected movement */}
      <div className="grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
        {SYS_META.map(({ key, label }) => {
          const after = pv.after[key];
          const delta = pv.deltas[key];
          const up = delta >= 0.05, down = delta <= -0.05;
          return (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">{label}</span>
                <span className={`tabular-nums font-bold ${up ? "text-emerald-400" : down ? "text-rose-400" : "text-slate-500"}`}>
                  {up ? "▲" : down ? "▼" : "–"} {delta >= 0 ? "+" : ""}{delta.toFixed(1)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[color:var(--accent)]" style={{ width: `${Math.round(after)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* freshness + injury risk meters */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Freshness after</div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-lg font-black tabular-nums">{freshAfter}%</span>
            <span className="text-xs text-slate-500">from {freshBefore}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: `${freshAfter}%`, background: freshAfter > 55 ? "#22c55e" : freshAfter > 35 ? "#f59e0b" : "#f43f5e" }} />
          </div>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Injury risk (team)</div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-lg font-black tabular-nums" style={{ color: riskColor(injPct) }}>{injPct}%</span>
            <span className="text-xs text-slate-500">someone down</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, injPct)}%`, background: riskColor(injPct) }} />
          </div>
        </div>
      </div>

      {/* championship preparation progress */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-slate-400">Championship prep</span>
          <span className="tabular-nums text-slate-400">{champ}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-indigo-400" style={{ width: `${Math.min(100, champ)}%` }} />
        </div>
      </div>

      {topRisk.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-rose-500/10 p-2.5 text-xs text-rose-200">
          <span className="mt-0.5 text-rose-400"><Icon name="pulse" size={14} /></span>
          <span>
            <span className="font-bold">Watch: </span>
            {topRisk.map((a) => `${a.name} (${Math.round(Math.max(a.injuryRisk, a.overtrainRisk) * 100)}%)`).join(", ")}
            {" "}most likely to break down this week.
          </span>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">{eyebrow}</div>
      <h2 className="text-lg font-black">{title}</h2>
    </div>
  );
}

function Hero({ p, save, rank }: { p: Program; save: GameSave; rank: number }) {
  return (
    <div className="panel relative overflow-hidden p-5" style={{ background: `linear-gradient(110deg, ${p.def.colorPrimary}2b, transparent 55%)` }}>
      <div className="flex items-center gap-4">
        <Crest name={p.def.name} color={p.def.colorPrimary} size={68} />
        <div className="flex-1">
          <div className="text-2xl font-black leading-tight">{p.def.name}</div>
          <div className="text-sm text-slate-400">{save.year} season · {save.phase === "offseason" ? "Offseason" : `Week ${save.week} of 12`} · ranked #{rank} nationally</div>
        </div>
      </div>
    </div>
  );
}

function Stepper({ week, phase }: { week: number; phase: string }) {
  const steps = [
    { w: 2, label: "Base" }, { w: 4, label: "Invite" }, { w: 6, label: "Invite" },
    { w: 8, label: "Invite" }, { w: 10, label: "Conference" }, { w: 11, label: "Regional" },
    { w: 12, label: "Nationals" },
  ];
  return (
    <div className="panel flex items-center gap-1 overflow-x-auto p-2.5">
      {steps.map((s, i) => {
        const done = phase === "offseason" || week > s.w;
        const cur = phase !== "offseason" && week <= s.w && (i === 0 || week > steps[i - 1].w);
        return (
          <div key={s.w} className="flex flex-1 items-center">
            <div className={`flex flex-1 flex-col items-center rounded-lg px-1 py-1.5 text-center ${cur ? "bg-[color:var(--accent)] text-slate-950" : done ? "bg-white/[0.07] text-slate-300" : "text-slate-500"}`}>
              <span className="text-[10px] font-black">{done && !cur ? "✓" : `W${s.w}`}</span>
              <span className="text-[9px] font-bold uppercase tracking-wide opacity-80">{s.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Standings({ save, rank }: { save: GameSave; rank: number }) {
  const rows = useMemo(() => nationalRankings(save).slice(0, 6), [save]);
  return (
    <section className="panel p-4">
      <SectionTitle eyebrow="National" title="Top programs" />
      <div className="space-y-1.5">
        {rows.map((r, i) => {
          const def = save.programs.find((p) => p.def.id === r.programId)!.def;
          return (
            <div key={r.programId} className="flex items-center gap-2 text-sm">
              <span className="w-4 text-slate-500">{i + 1}</span>
              <Crest name={def.name} color={def.colorPrimary} size={18} />
              <span className="flex-1 truncate">{def.name}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 border-t border-white/10 pt-2 text-xs text-slate-400">You are <span className="font-bold text-[color:var(--accent)]">#{rank}</span></div>
    </section>
  );
}

function NewsFeed({ log }: { log: string[] }) {
  return (
    <section className="panel p-4">
      <SectionTitle eyebrow="Inbox" title="Program news" />
      {log.length === 0 ? <div className="text-sm text-slate-500">No news yet — advance the season.</div> : (
        <ul className="space-y-2 text-sm text-slate-300">
          {log.slice(0, 8).map((l, i) => (
            <li key={i} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--accent)]" /><span>{l}</span></li>
          ))}
        </ul>
      )}
    </section>
  );
}

function QuickFacts({ p, rank, avg }: { p: Program; rank: number; avg: number }) {
  const rows: [string, string][] = [
    ["Prestige", String(p.prestige)], ["Coach reputation", String(p.coach.reputation)],
    ["National rank", `#${rank}`], ["Avg roster OVR", String(avg)],
    ["Roster", `${p.roster.length}/18`], ["Ops budget", `$${p.budget.operationsPot}k`],
  ];
  return (
    <section className="panel p-4">
      <SectionTitle eyebrow="At a glance" title="Program" />
      <dl className="grid grid-cols-2 gap-y-2 text-sm">
        {rows.map(([k, v]) => (<div key={k}><dt className="text-[11px] uppercase tracking-wide text-slate-500">{k}</dt><dd className="font-bold">{v}</dd></div>))}
      </dl>
    </section>
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
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-[color:var(--accent)]">Result</div>
          <h2 className="mt-1 text-xl font-black">{myTeam ? `You finished ${ordinal(myTeam.teamPlace)}` : "Race complete"}</h2>
        </div>
        <button className="btn-accent inline-flex items-center gap-2" onClick={onContinue}>Continue <Icon name="arrow" size={18} /></button>
      </div>
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Team scores</div>
          <div className="space-y-1">
            {result.teamScores.slice(0, 10).map((t) => {
              const def = nameById.get(t.programId)!;
              return (
                <div key={t.programId} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${t.programId === save.playerId ? "bg-[color:var(--accent)]/15 font-bold" : "bg-white/[0.03]"}`}>
                  <span className="w-5 text-slate-500">{t.teamPlace}</span>
                  <Crest name={def.name} color={def.colorPrimary} size={18} />
                  <span className="flex-1 truncate">{def.name}</span>
                  <span className="tabular-nums text-slate-300">{t.score}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Your runners</div>
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

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
