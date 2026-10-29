/**
 * Economy: saturating-returns spending effects, annual budgets, and investment
 * depreciation. effect(spend) = max · spend/(spend+K) — diminishing returns so
 * no single lever dominates (verified by the headless balance pass).
 */
import { clamp } from "./rng";
import { BALANCE } from "../config/balance";
import type { Program } from "./types";

export function saturating(spend: number, cfg: { max: number; k: number }): number {
  if (spend <= 0) return 0;
  return cfg.max * (spend / (spend + cfg.k));
}

export function annualBudget(prestige: number, lastNationalFinish: number | null): number {
  const e = BALANCE.economy.budgetByPrestige;
  let b = e.base + prestige * e.perPrestige;
  if (lastNationalFinish != null) {
    if (lastNationalFinish <= 3) b *= 1.25;
    else if (lastNationalFinish <= 10) b *= 1.12;
    else if (lastNationalFinish <= 31) b *= 1.04;
  }
  return Math.round(b);
}

/** Shoe benefit only applies while there's life left; 0 otherwise. */
export function effectiveShoeTier(p: Program): number {
  return p.budget.investments.shoeLifeRacesLeft > 0 ? p.budget.investments.shoeTier : 0;
}

export function depreciateShoes(p: Program, racesRun: number): void {
  p.budget.investments.shoeLifeRacesLeft = Math.max(0, p.budget.investments.shoeLifeRacesLeft - racesRun);
}

/** Buy/replace shoes from the operations pot if affordable. Returns spent. */
export function buyShoes(p: Program, tier: 0 | 1 | 2 | 3): number {
  const cost = BALANCE.economy.shoeTierCost[tier];
  if (p.budget.operationsPot < cost) return 0;
  p.budget.operationsPot -= cost;
  p.budget.investments.shoeTier = tier;
  p.budget.investments.shoeLifeRacesLeft = BALANCE.economy.shoeLifeRaces[tier];
  return cost;
}

/** Summer camp fitness-development multiplier (applied in offseason). */
export function campBoost(p: Program): number {
  return 1 + saturating(p.budget.summerCamp, BALANCE.economy.camp);
}

/** Recruiting pulling power from media + prestige spend. */
export function brandPull(p: Program): number {
  return saturating(p.budget.media, BALANCE.economy.media) + p.prestige / 200;
}

export function nilPower(p: Program): number {
  return saturating(p.budget.nilPool, BALANCE.economy.nil);
}

export function recruitBudgetPower(p: Program, intl: boolean): number {
  return intl
    ? saturating(p.budget.internationalRecruiting, BALANCE.economy.intl)
    : saturating(p.budget.domesticRecruiting, BALANCE.economy.domestic);
}

export function morale(p: Program): number {
  const roster = p.roster;
  if (!roster.length) return 60;
  return clamp(roster.reduce((s, a) => s + a.attrs.morale, 0) / roster.length, 1, 99);
}
