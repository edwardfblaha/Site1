import { useGame } from "../../state/store";
import { player } from "../../state/game";
import { projectedStrength } from "../../engine";
import { AthleteCard } from "../components/AthleteCard";

export function Roster() {
  const save = useGame((s) => s.save)!;
  const p = player(save);
  const roster = [...p.roster].sort((a, b) => projectedStrength(b) - projectedStrength(a));
  const sci = p.coach.staff.sportsScientist;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-black">Roster <span className="text-slate-400">({roster.length}/18)</span></h1>
        <div className="text-sm text-slate-500">Sports scientist tier {sci} {sci >= 2 ? "· potentials visible" : "· hidden attrs reveal through racing"}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {roster.map((a) => <AthleteCard key={a.id} a={a} sciTier={sci} />)}
      </div>
    </div>
  );
}
