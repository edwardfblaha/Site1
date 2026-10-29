import type { Athlete } from "../../engine";
import { AttrBar, Pill } from "./ui";

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "slate" | "blue"> = {
  healthy: "green", niggle: "amber", injured: "red", overtrained: "red", redshirt: "blue",
};

export function AthleteCard({ a, sciTier = 0 }: { a: Athlete; sciTier?: number }) {
  const freshness = Math.round(100 - a.fitness.fatigue);
  const statusLabel =
    a.status.kind === "healthy" ? "Healthy"
    : a.status.kind === "niggle" ? `Niggle (${a.status.weeksLeft}w)`
    : a.status.kind === "injured" ? `Injured (${a.status.weeksLeft}w)`
    : a.status.kind === "overtrained" ? `Overtrained (${a.status.weeksLeft}w)`
    : "Redshirt";

  const showHidden = (k: keyof typeof a.hidden) => (sciTier >= 2 || a.revealed[k]) ? a.hidden[k] : null;
  const pot = showHidden("potential");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <div className="font-semibold">{a.firstName} {a.lastName}</div>
          <div className="text-xs text-slate-500">
            {a.classYear} · {a.hometown}{a.international ? " 🌍" : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-amber-500">{"★".repeat(a.starRating)}<span className="text-slate-200">{"★".repeat(5 - a.starRating)}</span></div>
          <Pill tone={STATUS_TONE[a.status.kind]}>{statusLabel}</Pill>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-1">
        <AttrBar label="Aerobic" value={a.attrs.aerobic} />
        <AttrBar label="Threshold" value={a.attrs.threshold} />
        <AttrBar label="Speed/Kick" value={a.attrs.speed} />
        <AttrBar label="Hills" value={a.attrs.hills} />
        <AttrBar label="Durability" value={a.attrs.durability} />
        <AttrBar label="Race IQ" value={a.attrs.raceIQ} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>Fresh {freshness}%</span>
        <span>Morale {a.attrs.morale}</span>
        <span>NIL ${a.nil}k</span>
        {pot != null && <Pill tone="blue">Potential {pot}</Pill>}
        {a.portalRisk > 55 && <Pill tone="amber">Portal risk</Pill>}
      </div>
    </div>
  );
}
