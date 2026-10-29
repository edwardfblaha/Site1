import { useState } from "react";
import { useGame } from "../../state/store";
import { player, recruitBoard } from "../../state/game";
import { Pill, OVR } from "../components/ui";
import { Avatar } from "../components/art";

export function Recruiting() {
  const save = useGame((s) => s.save)!;
  const sign = useGame((s) => s.signRecruit);
  const p = player(save);
  const [msg, setMsg] = useState("");
  const board = recruitBoard(save, 24);
  const canSign = save.phase === "offseason";
  const ovr = (a: typeof board[number]["recruit"]["athlete"]) => Math.round((a.attrs.aerobic + a.attrs.threshold + a.attrs.speed + a.attrs.hills) / 4);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black">Recruiting board</h1>
          <p className="text-sm text-slate-400">Signed this cycle {save.signedThisCycle}/6 · roster {p.roster.length}/18</p>
        </div>
        {!canSign && <Pill tone="amber">Signing opens in the offseason</Pill>}
      </div>
      {msg && <div className="panel px-4 py-2 text-sm">{msg}</div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {board.map(({ recruit: r, interest, odds }) => (
          <div key={r.id} className="panel p-4">
            <div className="flex items-center gap-3">
              <Avatar name={`${r.athlete.firstName} ${r.athlete.lastName}`} color={p.def.colorPrimary} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{r.athlete.firstName} {r.athlete.lastName}</div>
                <div className="text-xs text-slate-400">{r.kind === "hs" ? "High school" : r.kind === "international" ? "International 🌍" : "Transfer"}</div>
              </div>
              <OVR value={ovr(r.athlete)} size="sm" />
            </div>
            <div className="mt-2 text-amber-400 text-sm">{"★".repeat(r.starRating)}<span className="text-white/15">{"★".repeat(5 - r.starRating)}</span></div>
            <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
              <span>Interest {interest}</span>
              <span>Odds {Math.round(odds * 100)}%</span>
              <span>{r.competingOffers} rivals</span>
            </div>
            <button disabled={!canSign} onClick={() => setMsg(sign(r.id).reason)}
              className="btn-accent mt-3 w-full py-2 text-sm disabled:opacity-30">Make an offer</button>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">Sign odds rise with prestige, NIL, media, official visits, coach reputation and recruiting spend — set those on the Budget page.</p>
    </div>
  );
}
