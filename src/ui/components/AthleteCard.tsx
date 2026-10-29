import type { Athlete } from "../../engine";
import { AttrBar, Pill, OVR } from "./ui";
import { Avatar } from "./art";

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "slate" | "blue"> = {
  healthy: "green", niggle: "amber", injured: "red", overtrained: "red", redshirt: "blue",
};

function ovrOf(a: Athlete): number {
  return Math.round((a.attrs.aerobic + a.attrs.threshold + a.attrs.speed + a.attrs.hills) / 4);
}

export function AthleteCard({ a, color = "#38bdf8", sciTier = 0 }: { a: Athlete; color?: string; sciTier?: number }) {
  const statusLabel =
    a.status.kind === "healthy" ? "Healthy"
    : a.status.kind === "niggle" ? `Niggle ${a.status.weeksLeft}w`
    : a.status.kind === "injured" ? `Injured ${a.status.weeksLeft}w`
    : a.status.kind === "overtrained" ? `Overtrained ${a.status.weeksLeft}w`
    : "Redshirt";
  const showHidden = (k: keyof typeof a.hidden) => (sciTier >= 2 || a.revealed[k]) ? a.hidden[k] : null;
  const pot = showHidden("potential");

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center gap-3">
        <Avatar name={`${a.firstName} ${a.lastName}`} color={color} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{a.firstName} {a.lastName}</div>
          <div className="truncate text-xs text-slate-400">{a.classYear} · {a.hometown}{a.international ? " 🌍" : ""}</div>
          <div className="mt-0.5 text-amber-400">{"★".repeat(a.starRating)}<span className="text-white/15">{"★".repeat(5 - a.starRating)}</span></div>
        </div>
        <OVR value={ovrOf(a)} />
      </div>
      <div className="grid gap-1">
        <AttrBar label="Aerobic" value={a.attrs.aerobic} />
        <AttrBar label="Threshold" value={a.attrs.threshold} />
        <AttrBar label="Speed/Kick" value={a.attrs.speed} />
        <AttrBar label="Hills" value={a.attrs.hills} />
        <AttrBar label="Durability" value={a.attrs.durability} />
        <AttrBar label="Race IQ" value={a.attrs.raceIQ} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Pill tone={STATUS_TONE[a.status.kind]}>{statusLabel}</Pill>
        <Pill>Fresh {Math.round(100 - a.fitness.fatigue)}%</Pill>
        <Pill>Morale {a.attrs.morale}</Pill>
        <Pill>${a.nil}k NIL</Pill>
        {pot != null && <Pill tone="blue">POT {pot}</Pill>}
        {a.portalRisk > 55 && <Pill tone="amber">Portal risk</Pill>}
      </div>
    </div>
  );
}
