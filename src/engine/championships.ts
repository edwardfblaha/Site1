/**
 * Championship path: conference → regional (top 2 auto-qualify per region) →
 * Kolas-style at-large (13 bids) → 31-team national championship.
 *
 * Kolas at-large: count each candidate team's head-to-head wins over the set of
 * teams that finished top-2 at their regional; take the best, add it to that
 * "key team" set, recount, and repeat until 13 at-large teams are chosen.
 */
import { BALANCE } from "../config/balance";
import type { Program, RaceResult } from "./types";

export interface HeadToHead {
  // wins[a][b] = number of common meets where a's team finished ahead of b's
  wins: Map<string, Map<string, number>>;
}

/** Accumulate team-vs-team head-to-head across every scored meet. */
export function computeHeadToHead(results: RaceResult[]): HeadToHead {
  const wins = new Map<string, Map<string, number>>();
  const bump = (a: string, b: string) => {
    const row = wins.get(a) ?? wins.set(a, new Map()).get(a)!;
    row.set(b, (row.get(b) ?? 0) + 1);
  };
  for (const res of results) {
    const ts = res.teamScores;
    for (let i = 0; i < ts.length; i++) {
      for (let j = i + 1; j < ts.length; j++) {
        // lower teamPlace = finished ahead = beat the other
        if (ts[i].teamPlace < ts[j].teamPlace) bump(ts[i].programId, ts[j].programId);
        else bump(ts[j].programId, ts[i].programId);
      }
    }
  }
  return { wins };
}

function h2hWins(h: HeadToHead, team: string, over: Set<string>): number {
  const row = h.wins.get(team);
  if (!row) return 0;
  let n = 0;
  for (const key of over) n += row.get(key) ?? 0;
  return n;
}

export interface QualificationResult {
  autoQ: string[];       // 2 per region
  atLarge: string[];     // 13 Kolas selections
  nationalsField: string[]; // 31 teams
  byRegion: Record<string, string[]>; // regional finish order (team ids)
}

/**
 * @param regionalResults one RaceResult per region (already scored)
 * @param seasonResults every scored meet of the season (for head-to-head)
 */
export function selectQualifiers(
  _programs: Program[],
  regionalResults: Record<string, RaceResult>,
  seasonResults: RaceResult[]
): QualificationResult {
  const { autoQualPerRegion, atLargeBids } = BALANCE.champs;
  const byRegion: Record<string, string[]> = {};
  const autoQ: string[] = [];

  for (const [region, res] of Object.entries(regionalResults)) {
    const order = [...res.teamScores].sort((a, b) => a.teamPlace - b.teamPlace).map((t) => t.programId);
    byRegion[region] = order;
    autoQ.push(...order.slice(0, autoQualPerRegion));
  }

  const h2h = computeHeadToHead(seasonResults);
  const qualified = new Set(autoQ);
  const keyTeams = new Set(autoQ); // "teams that finished top-2 at their regional"

  // Candidates = teams that raced a regional but didn't auto-qualify.
  const candidates = new Set<string>();
  for (const res of Object.values(regionalResults)) {
    for (const t of res.teamScores) if (!qualified.has(t.programId)) candidates.add(t.programId);
  }

  const atLarge: string[] = [];
  while (atLarge.length < atLargeBids && candidates.size > 0) {
    let best: string | null = null;
    let bestWins = -1;
    for (const c of candidates) {
      const w = h2hWins(h2h, c, keyTeams);
      // tiebreak: higher season prestige
      if (w > bestWins) { bestWins = w; best = c; }
    }
    if (best == null) break;
    atLarge.push(best);
    candidates.delete(best);
    qualified.add(best);
    keyTeams.add(best); // iterate: the new at-large joins the key set
  }

  return {
    autoQ,
    atLarge,
    nationalsField: [...autoQ, ...atLarge].slice(0, BALANCE.champs.nationalsTeams),
    byRegion,
  };
}
