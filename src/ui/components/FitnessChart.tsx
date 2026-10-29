import type { FitnessPoint } from "../../state/game";

/** Team fitness + freshness over the season. */
export function FitnessChart({ points }: { points: FitnessPoint[] }) {
  if (points.length < 2) {
    return <div className="text-sm text-slate-500">Train a few weeks to see the team's fitness & freshness curve.</div>;
  }
  const w = 560, h = 160, padL = 26, padB = 20, padT = 10, padR = 10;
  const weeks = points.map((p) => p.week);
  const minW = Math.min(...weeks), maxW = Math.max(...weeks);
  const X = (wk: number) => padL + ((wk - minW) / Math.max(1, maxW - minW)) * (w - padL - padR);
  const Y = (v: number) => h - padB - (v / 100) * (h - padB - padT);
  const line = (key: "fitness" | "fresh") => points.map((p, i) => `${i ? "L" : "M"}${X(p.week).toFixed(1)},${Y(p[key]).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={padL} y1={Y(g)} x2={w - padR} y2={Y(g)} stroke="rgba(255,255,255,.08)" />
          <text x={padL - 4} y={Y(g) + 3} textAnchor="end" className="fill-slate-500" fontSize="8">{g}</text>
        </g>
      ))}
      <path d={line("fitness")} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
      <path d={line("fresh")} fill="none" stroke="#34d399" strokeWidth="2.5" strokeDasharray="4 3" />
      {points.map((p) => <text key={p.week} x={X(p.week)} y={h - 6} textAnchor="middle" className="fill-slate-500" fontSize="8">w{p.week}</text>)}
      <g fontSize="9" className="fill-slate-400">
        <rect x={w - 150} y={padT} width="9" height="3" fill="var(--accent)" /><text x={w - 138} y={padT + 4}>Fitness</text>
        <rect x={w - 86} y={padT} width="9" height="3" fill="#34d399" /><text x={w - 74} y={padT + 4}>Freshness</text>
      </g>
    </svg>
  );
}
