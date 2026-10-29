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
export { BALANCE } from "../config/balance";
