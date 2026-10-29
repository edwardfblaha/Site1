/**
 * Recruiting: a generated pool each offseason (HS domestic, international,
 * transfer portal), interest + signing probability, and an AI signing pass.
 * Signing is a logistic of interest, prestige gap, NIL, visits, media, coach
 * reputation and competing offers (coefficients in balance.ts).
 */
import { Rng, clamp } from "./rng";
import { BALANCE } from "../config/balance";
import { generateRecruit } from "./athletes";
import { nilPower, brandPull, recruitBudgetPower } from "./economy";
import type { Program, Recruit } from "./types";

export function generateRecruitPool(rng: Rng, year: number): Recruit[] {
  const r = rng.fork(`recruits:${year}`);
  const pool: Recruit[] = [];
  const { poolSizeHS, poolSizeIntl, poolSizeTransfer } = BALANCE.recruiting;
  for (let i = 0; i < poolSizeHS; i++) pool.push(generateRecruit(r, "hs"));
  for (let i = 0; i < poolSizeIntl; i++) pool.push(generateRecruit(r, "international"));
  for (let i = 0; i < poolSizeTransfer; i++) pool.push(generateRecruit(r, "transfer"));
  return pool;
}

/** Base interest of a recruit in a program (0–99), before active recruiting. */
export function baseInterest(recruit: Recruit, p: Program): number {
  let interest = p.prestige * 0.5 + recruit.athlete.starRating * 3;
  if (recruit.kind === "international") interest += nilPower(p) * 30 - 10; // intl chase NIL
  interest += brandPull(p) * 20;
  return clamp(Math.round(interest), 1, 99);
}

/** Probability a program signs a recruit given its recruiting investment. */
export function signingProbability(recruit: Recruit, p: Program, interest: number): number {
  const c = BALANCE.recruiting;
  const intl = recruit.kind === "international";
  const u =
    c.beta0 +
    c.interest * interest +
    c.prestigeGap * (p.prestige - recruit.athlete.starRating * 18) +
    c.nil * nilPower(p) +
    c.visit * Math.min(p.budget.officialVisits, 6) +
    c.media * brandPull(p) +
    c.rep * p.coach.reputation +
    c.recruitBudget * recruitBudgetPower(p, intl) -
    c.competing * recruit.competingOffers;
  return 1 / (1 + Math.exp(-u));
}

/**
 * AI signing pass: each program, strongest first, pursues the best available
 * recruits up to the roster limit. Resolves probabilistically. Signed recruits
 * join the program as freshmen. Mutates programs + pool.
 */
export function runRecruitingAI(programs: Program[], pool: Recruit[], rng: Rng): void {
  const order = [...programs].sort((a, b) => b.prestige - a.prestige);
  const available = pool.filter((r) => !r.signedBy);
  // sort recruits best-first once
  available.sort((a, b) => b.athlete.starRating - a.athlete.starRating || b.athlete.hidden.potential - a.athlete.hidden.potential);

  for (const p of order) {
    const r = rng.fork(`sign:${p.def.id}`);
    const need = BALANCE.recruiting.rosterLimit - p.roster.length;
    if (need <= 0) continue;
    let signed = 0;
    for (const rec of available) {
      if (signed >= Math.min(need, 5)) break;
      if (rec.signedBy) continue;
      const interest = baseInterest(rec, p);
      const prob = signingProbability(rec, p, interest) * (0.9 / Math.max(1, rec.competingOffers * 0.3));
      if (r.chance(clamp(prob, 0, 0.95))) {
        rec.signedBy = p.def.id;
        rec.athlete.classYear = "FR";
        rec.athlete.eligibilityLeft = rec.kind === "transfer" ? rec.athlete.eligibilityLeft : 4;
        p.roster.push(rec.athlete);
        signed++;
      } else {
        rec.competingOffers++;
      }
    }
  }
}
