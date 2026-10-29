import type { ReactNode } from "react";

/** Madden-style overall rating color ramp. */
export function ovrColor(v: number): string {
  if (v >= 85) return "#22c55e";
  if (v >= 75) return "#84cc16";
  if (v >= 65) return "#eab308";
  if (v >= 55) return "#f59e0b";
  return "#ef4444";
}

export function OVR({ value, size = "md" }: { value: number; size?: "sm" | "md" | "lg" }) {
  const s = size === "lg" ? "h-14 w-14 text-2xl" : size === "sm" ? "h-9 w-9 text-sm" : "h-11 w-11 text-lg";
  return (
    <div className={`flex ${s} flex-col items-center justify-center rounded-xl font-black leading-none`}
      style={{ background: `${ovrColor(value)}22`, color: ovrColor(value), border: `1px solid ${ovrColor(value)}55` }}>
      {value}
      <span className="text-[8px] font-bold tracking-wider opacity-70">OVR</span>
    </div>
  );
}

export function Stat({ label, value, sub, color }: { label: string; value: ReactNode; sub?: string; color?: string }) {
  return (
    <div className="panel p-4">
      <div className="text-2xl font-black tabular-nums" style={color ? { color } : undefined}>{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function AttrBar({ label, value }: { label: string; value: number }) {
  const hue = 8 + (value / 99) * 130;
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[11px] text-slate-400">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: `hsl(${hue} 75% 50%)` }} />
      </div>
      <span className="w-6 shrink-0 text-right text-[11px] font-semibold tabular-nums text-slate-300">{value}</span>
    </div>
  );
}

const TONES: Record<string, string> = {
  slate: "bg-white/10 text-slate-300", green: "bg-emerald-500/20 text-emerald-300",
  amber: "bg-amber-500/20 text-amber-300", red: "bg-rose-500/20 text-rose-300", blue: "bg-sky-500/20 text-sky-300",
};
export function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return <span className={`chip ${TONES[tone]}`}>{children}</span>;
}

export function fmtTime(s: number): string {
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
}
