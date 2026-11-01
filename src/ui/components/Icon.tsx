/** Clean line icons (no emojis). 24px grid, inherit color via currentColor. */
import type { CSSProperties } from "react";

const P: Record<string, string> = {
  home: "M3 11.5 12 4l9 7.5M5 10v10h14V10",
  roster: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M21 19v-1a4 4 0 0 0-3-3.9M16 4.1A4 4 0 0 1 16 11.9",
  rankings: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  recruit: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21v-1a6 6 0 0 1 6-6h1M19 14v6M22 17h-6",
  budget: "M3 7h18v12H3zM3 7l2.5-4h13L21 7M16 13h2",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 0-3 3M10 16h4M9 20h6M12 16v4",
  train: "M6.5 6.5l11 11M4 9l2-2M17 20l2-2M3 14l7-7 7 7-7 7zM14 3l7 7",
  flag: "M5 21V4M5 4c3-2 7 2 10 0v9c-3 2-7-2-10 0",
  tip: "M9 18h6M10 21h4M12 3a6 6 0 0 1 4 10.5c-.7.7-1 1.2-1 2.5H9c0-1.3-.3-1.8-1-2.5A6 6 0 0 1 12 3z",
  pulse: "M3 12h4l2 6 4-14 2 8h6",
  arrow: "M5 12h14M13 6l6 6-6 6",
  check: "M4 12l5 5 11-11",
  calendar: "M4 6h16v15H4zM4 10h16M8 3v4M16 3v4",
  shoe: "M2 16h13l5 1c1 .3 2 1 2 2v1H2zM2 16V9l3-1 2 3 3 1 2 3",
  flask: "M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
};

export function Icon({ name, size = 20, className, style, strokeWidth = 1.8 }: {
  name: keyof typeof P | string; size?: number; className?: string; style?: CSSProperties; strokeWidth?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style} aria-hidden>
      <path d={P[name] ?? P.home} />
    </svg>
  );
}
