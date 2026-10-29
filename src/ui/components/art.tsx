/** Generated team crest (no real logos): a shield split in the program's
 * colors with a monogram. Deterministic from name/colors. */
export function Crest({ name, color, secondary, size = 44, abbr }: {
  name: string; color: string; secondary?: string; size?: number; abbr?: string;
}) {
  const mono = (abbr ?? initials(name)).slice(0, 3);
  const dark = shade(color, -28);
  const id = "cr" + hashId(name + color);
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className="shrink-0">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor={secondary ?? dark} />
        </linearGradient>
      </defs>
      <path d="M24 2 L44 8 V26 C44 38 35 44 24 47 C13 44 4 38 4 26 V8 Z"
        fill={`url(#${id})`} stroke="rgba(255,255,255,.35)" strokeWidth="1.5" />
      <path d="M24 2 L44 8 V26 C44 38 35 44 24 47 Z" fill="rgba(0,0,0,.14)" />
      <text x="24" y="30" textAnchor="middle" fontSize="15" fontWeight="900"
        fill="#fff" style={{ letterSpacing: "-.5px" }}>{mono}</text>
    </svg>
  );
}

/** Runner avatar: a colored jersey disc with initials + a stable number. */
export function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  const num = (hashId(name) % 98) + 1;
  const id = "av" + hashId(name + color);
  const dark = shade(color, -30);
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(color, 12)} /><stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill={`url(#${id})`} stroke="rgba(255,255,255,.25)" />
      {/* simple jersey/shoulders silhouette */}
      <path d="M8 34 C9 25 14 22 20 22 C26 22 31 25 32 34 Z" fill="rgba(255,255,255,.9)" opacity=".92" />
      <circle cx="20" cy="15" r="6.5" fill="rgba(255,255,255,.92)" />
      <text x="20" y="37.5" textAnchor="middle" fontSize="7" fontWeight="800" fill="#fff" opacity=".85">#{num}</text>
      <text x="20" y="17.5" textAnchor="middle" fontSize="7.5" fontWeight="900" fill={dark}>{initials(name)}</text>
    </svg>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).map((p) => p[0]).join("").toUpperCase();
}
function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}
function shade(hex: string, amt: number): string {
  const m = hex.replace("#", "");
  const n = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const r = clamp255(parseInt(n.slice(0, 2), 16) + amt);
  const g = clamp255(parseInt(n.slice(2, 4), 16) + amt);
  const b = clamp255(parseInt(n.slice(4, 6), 16) + amt);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
const clamp255 = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
