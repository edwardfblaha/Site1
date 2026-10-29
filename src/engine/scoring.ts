/**
 * Standard NCAA cross country team scoring.
 *
 * Rules:
 *  - Only a team's first 7 finishers count; 8th+ are ignored.
 *  - Teams with fewer than 5 finishers are incomplete: their runners are
 *    removed before scoring, so they don't take places from complete teams.
 *  - Among the retained runners, finishing places are recomputed; a team's
 *    score is the sum of its top-5 recomputed places. The 6th and 7th runners
 *    "displace" (occupy places) but don't score.
 *  - Lowest score wins. Tiebreak: 6th runner's place (then 5th).
 */
import type { RunnerResult, TeamScore } from "./types";

const MIN_TEAM = 5;
const MAX_COUNT = 7;

export function scoreMeet(runners: RunnerResult[]): TeamScore[] {
  const finish = [...runners].sort((a, b) => a.place - b.place);

  // first 7 per team, in finish order
  const perTeam = new Map<string, RunnerResult[]>();
  for (const r of finish) {
    const list = perTeam.get(r.programId) ?? perTeam.set(r.programId, []).get(r.programId)!;
    if (list.length < MAX_COUNT) list.push(r);
  }

  const complete = new Set<string>();
  for (const [pid, list] of perTeam) if (list.length >= MIN_TEAM) complete.add(pid);

  // retained = counted runners from complete teams, recomputed places
  const retained = finish.filter(
    (r) => complete.has(r.programId) && perTeam.get(r.programId)!.includes(r)
  );
  retained.forEach((r, i) => (r.scoringPlace = i + 1));
  // non-retained runners carry scoringPlace 0
  for (const r of finish) if (!retained.includes(r)) r.scoringPlace = 0;

  const scores: TeamScore[] = [];
  for (const pid of complete) {
    const list = perTeam.get(pid)!; // ≤7, finish order
    const scorers = list.slice(0, 5);
    const displacers = list.slice(5, 7);
    scores.push({
      programId: pid,
      score: scorers.reduce((s, r) => s + r.scoringPlace, 0),
      scorers: scorers.map((r) => r.athleteId),
      displacers: displacers.map((r) => r.athleteId),
      sixthRunnerPlace: displacers[0]?.scoringPlace ?? scorers[4].scoringPlace,
      teamPlace: 0,
    });
  }

  scores.sort((a, b) => a.score - b.score || a.sixthRunnerPlace - b.sixthRunnerPlace);
  scores.forEach((t, i) => (t.teamPlace = i + 1));
  return scores;
}
