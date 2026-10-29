import type { ReactNode } from "react";

export function Stat({ label, value, sub, color }: { label: string; value: ReactNode; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-2xl font-black tabular-nums" style={color ? { color } : undefined}>{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

/** attribute bar 1–99 */
export function AttrBar({ label, value }: { label: string; value: number }) {
  const hue = 8 + (value / 99) * 130; // red→green
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-slate-500">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: `hsl(${hue} 70% 45%)` }} />
      </div>
      <span className="w-7 shrink-0 text-right text-xs font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "red" | "blue" }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600", green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700", red: "bg-rose-100 text-rose-700", blue: "bg-sky-100 text-sky-700",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function fmtTime(s: number): string {
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
}
