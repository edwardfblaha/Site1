import type { FitnessPoint } from "../../state/game";

/** Team fitness + freshness over the season (two lines on an SVG). */
export function FitnessChart({ points }: { points: FitnessPoint[] }) {
  if (points.length < 2) {
    return <div className="text-sm text-slate-400">Train a few weeks to see the team's fitness & freshness curve.</div>;
  }
  const w = 560, h = 180, padL = 28, padB = 24, padT = 12, padR = 12;
  const weeks = points.map((p) => p.week);
  const minW = Math.min(...weeks), maxW = Math.max(...weeks);
  const X = (wk: number) => padL + ((wk - minW) / Math.max(1, maxW - minW)) * (w - padL - padR);
  const Y = (v: number) => h - padB - (v / 100) * (h - padB - padT);
  const line = (key: "fitness" | "fresh") =>
    points.map((p, i) => `${i ? "L" : "M"}${X(p.week).toFixed(1)},${Y(p[key]).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={padL} y1={Y(g)} x2={w - padR} y2={Y(g)} stroke="#e2e8f0" />
          <text x={padL - 4} y={Y(g) + 3} textAnchor="end" className="fill-slate-400" fontSize="8">{g}</text>
        </g>
      ))}
      <path d={line("fitness")} fill="none" stroke="#2563eb" strokeWidth="2.5" />
      <path d={line("fresh")} fill="none" stroke="#10b981" strokeWidth="2.5" strokeDasharray="4 3" />
      {points.map((p) => (
        <text key={p.week} x={X(p.week)} y={h - 8} textAnchor="middle" className="fill-slate-400" fontSize="8">w{p.week}</text>
      ))}
      <g fontSize="9" className="fill-slate-500">
        <rect x={w - 150} y={padT} width="9" height="3" fill="#2563eb" />
        <text x={w - 138} y={padT + 4}>Fitness</text>
        <rect x={w - 90} y={padT} width="9" height="3" fill="#10b981" />
        <text x={w - 78} y={padT + 4}>Freshness</text>
      </g>
    </svg>
  );
}
