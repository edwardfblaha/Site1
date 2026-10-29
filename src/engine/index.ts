/**
 * Public engine API. The UI and CLI import from here only.
 * (Later phases add race/season/championship/recruiting exports.)
 */
export * from "./types";
export { Rng, hashSeed, clamp } from "./rng";
export { generateAthlete, generateRoster, generateRecruit } from "./athletes";
export { buildLeague, findProgram, LEAGUE } from "./league";
export { simulateRace, type RaceEntrant } from "./race";
export { scoreMeet } from "./scoring";
export { simulateMeet } from "./meet";
export { applyTraining, developAthlete, overall, type TrainCtx } from "./training";
export { aiTrainingChoice, aiLineup, projectedStrength, competenceOf } from "./ai";
export { computeHeadToHead, selectQualifiers, type QualificationResult } from "./championships";
export {
  simulateSeason, runOffseason, trainLeagueWeek, runMeet, raceWeekMeets, runNationals,
  teamStrength, NATIONALS_WEEK, type SeasonResult, type WeekMeetOutcome,
} from "./season";
export { annualBudget, saturating, effectiveShoeTier, depreciateShoes, buyShoes, campBoost, brandPull, nilPower, recruitBudgetPower, morale } from "./economy";
export { generateRecruitPool, baseInterest, signingProbability, runRecruitingAI } from "./recruiting";
export { expectationFor, setExpectations, updateCareer, jobOffers, shouldFire, type JobOffer, type CareerUpdate } from "./career";
export { maybeEvent, type GameEvent, type EventChoice } from "./events";
export { runPortal, graduateAndDevelop, runFullOffseason, preseasonReset } from "./offseason";
export { BALANCE } from "../config/balance";
