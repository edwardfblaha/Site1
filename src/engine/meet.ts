/** Run a meet: simulate the field, then score it. */
import { Rng } from "./rng";
import { simulateRace, type RaceEntrant } from "./race";
import { scoreMeet } from "./scoring";
import type { Meet, RaceResult } from "./types";

export function simulateMeet(meet: Meet, entrants: RaceEntrant[], rng: Rng): RaceResult {
  const runners = simulateRace(meet.course, meet.tier, entrants, rng);
  const teamScores = scoreMeet(runners);
  return { meetId: meet.id, week: meet.week, runners, teamScores };
}

export type { RaceEntrant } from "./race";
