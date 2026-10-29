/**
 * Narrative events with 2–3 choices and clear consequences. Pure: each option
 * carries an `apply` that mutates the program/athlete. The UI presents choices;
 * headless/AI picks a reasonable default (index 0).
 */
import { Rng, clamp } from "./rng";
import type { Program, Athlete } from "./types";

export interface EventChoice {
  label: string;
  detail: string;
  apply: (p: Program, a: Athlete | undefined, rng: Rng) => void;
}
export interface GameEvent {
  id: string;
  title: string;
  body: string;
  athleteId?: string;
  choices: EventChoice[];
}

type Factory = (p: Program, rng: Rng) => GameEvent | null;

const star = (p: Program): Athlete | undefined =>
  [...p.roster].sort((a, b) => b.starRating - a.starRating)[0];

const FACTORIES: Factory[] = [
  (p) => {
    const a = star(p);
    if (!a) return null;
    return {
      id: "nil-ask", athleteId: a.id,
      title: "NIL request",
      body: `${a.firstName} ${a.lastName} wants a bigger NIL deal, citing offers elsewhere.`,
      choices: [
        { label: "Pay up (+$15k NIL)", detail: "Morale up, budget down.", apply: (pp, aa) => { if (aa) { aa.nil += 15; aa.attrs.morale = clamp(aa.attrs.morale + 8, 1, 99); aa.portalRisk = clamp(aa.portalRisk - 20, 0, 99); } pp.budget.operationsPot -= 15; } },
        { label: "Offer a token raise (+$4k)", detail: "Small morale bump.", apply: (pp, aa) => { if (aa) { aa.nil += 4; aa.attrs.morale = clamp(aa.attrs.morale + 2, 1, 99); } pp.budget.operationsPot -= 4; } },
        { label: "Decline", detail: "Portal risk rises.", apply: (_pp, aa) => { if (aa) { aa.attrs.morale = clamp(aa.attrs.morale - 8, 1, 99); aa.portalRisk = clamp(aa.portalRisk + 22, 0, 99); } } },
      ],
    };
  },
  (p) => {
    const fr = p.roster.filter((a) => a.classYear === "FR").sort((a, b) => b.hidden.potential - a.hidden.potential)[0];
    if (!fr) return null;
    return {
      id: "walkon-breakout", athleteId: fr.id,
      title: "Breakout in practice",
      body: `Freshman ${fr.firstName} ${fr.lastName} has been crushing workouts. Promote him?`,
      choices: [
        { label: "Fast-track him", detail: "Reveal potential; small fitness jump, slight injury risk.", apply: (_pp, aa, rng) => { if (aa) { aa.revealed.potential = true; aa.fitness.vo2 = clamp(aa.fitness.vo2 + 5, 0, 99); if (rng.chance(0.2)) aa.status = { kind: "niggle", weeksLeft: 1 }; } } },
        { label: "Bring him along slowly", detail: "Morale up, no risk.", apply: (_pp, aa) => { if (aa) aa.attrs.morale = clamp(aa.attrs.morale + 4, 1, 99); } },
      ],
    };
  },
  (p) => {
    const a = star(p);
    if (!a) return null;
    return {
      id: "rival-courts", athleteId: a.id,
      title: "A rival comes calling",
      body: `A powerhouse program is quietly recruiting ${a.firstName} ${a.lastName} to transfer.`,
      choices: [
        { label: "Reaffirm his role + NIL (+$10k)", detail: "Lowers portal risk.", apply: (pp, aa) => { if (aa) { aa.portalRisk = clamp(aa.portalRisk - 25, 0, 99); aa.nil += 10; } pp.budget.operationsPot -= 10; } },
        { label: "Trust the relationship", detail: "Free, but risky.", apply: (_pp, aa, rng) => { if (aa && rng.chance(0.5)) aa.portalRisk = clamp(aa.portalRisk + 15, 0, 99); } },
      ],
    };
  },
  (p) => {
    const a = p.roster.find((x) => x.international);
    if (!a) return null;
    return {
      id: "homesick", athleteId: a.id,
      title: "Homesickness",
      body: `${a.firstName} ${a.lastName} is struggling with being far from home.`,
      choices: [
        { label: "Fund a trip home ($6k)", detail: "Morale recovers.", apply: (pp, aa) => { if (aa) aa.attrs.morale = clamp(aa.attrs.morale + 12, 1, 99); pp.budget.operationsPot -= 6; } },
        { label: "Pair him with a mentor", detail: "Smaller boost, free.", apply: (_pp, aa) => { if (aa) aa.attrs.morale = clamp(aa.attrs.morale + 5, 1, 99); } },
      ],
    };
  },
];

/** Maybe produce one event this offseason for the player program. */
export function maybeEvent(p: Program, rng: Rng): GameEvent | null {
  const r = rng.fork(`event:${p.def.id}`);
  const shuffled = r.shuffle([...FACTORIES]);
  for (const f of shuffled) {
    const e = f(p, r);
    if (e) return e;
  }
  return null;
}
