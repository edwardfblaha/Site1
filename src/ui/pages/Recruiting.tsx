import { useState } from "react";
import { useGame } from "../../state/store";
import { player, recruitBoard } from "../../state/game";
import { Pill } from "../components/ui";

export function Recruiting() {
  const save = useGame((s) => s.save)!;
  const sign = useGame((s) => s.signRecruit);
  const p = player(save);
  const [msg, setMsg] = useState("");
  const board = recruitBoard(save, 24);

  const canSign = save.phase === "offseason";

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black">Recruiting board</h1>
          <p className="text-slate-500">Signed this cycle: {save.signedThisCycle}/6 · roster {p.roster.length}/18</p>
        </div>
        {!canSign && <Pill tone="amber">Signing opens in the offseason</Pill>}
      </div>
      {msg && <div className="rounded-lg bg-slate-100 px-4 py-2 text-sm">{msg}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-2">Recruit</th><th>Type</th><th>★</th><th className="text-right">Interest</th><th className="text-right">Sign odds</th><th></th></tr>
          </thead>
          <tbody>
            {board.map(({ recruit: r, interest, odds }) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-1.5">
                  <div className="font-medium">{r.athlete.firstName} {r.athlete.lastName}</div>
                  <div className="text-xs text-slate-400">{r.athlete.hometown}{r.athlete.international ? " 🌍" : ""}</div>
                </td>
                <td className="text-slate-500">{r.kind === "hs" ? "HS" : r.kind === "international" ? "Int'l" : "Transfer"}</td>
                <td className="text-amber-500">{"★".repeat(r.starRating)}</td>
                <td className="text-right tabular-nums">{interest}</td>
                <td className="text-right tabular-nums">{Math.round(odds * 100)}%</td>
                <td className="text-right">
                  <button disabled={!canSign} onClick={() => setMsg(sign(r.id).reason)}
                    className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-30">
                    Offer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        Sign odds rise with prestige, NIL, media, official visits, coach reputation and recruiting spend — tune these on the Budget page.
      </p>
    </div>
  );
}
