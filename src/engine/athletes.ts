/**
 * Procedural athlete generation. Deterministic given an Rng.
 *
 * An athlete's visible attributes are drawn around a "talent center" that
 * scales with their star rating (which itself scales with program prestige and
 * recruit kind). Hidden attributes (potential, injury proneness, big-meet
 * temperament) are drawn separately and only partially revealed to the player.
 */
import { Rng, clamp } from "./rng";
import type {
  Athlete, Attributes, HiddenAttributes, Fitness, ClassYear, Recruit, RecruitKind,
} from "./types";
import {
  FIRST_NAMES, LAST_NAMES, US_HOMETOWNS, INTL_ORIGINS,
} from "./names";

/** Deterministic id: consumes two RNG draws, no global mutable state. */
function uid(prefix: string, rng: Rng): string {
  const a = rng.int(0, 0xffffffff).toString(36);
  const b = rng.int(0, 0xffffffff).toString(36);
  return `${prefix}_${a}${b}`;
}

function attr(rng: Rng, center: number, sd = 9): number {
  return clamp(Math.round(rng.gauss(center, sd)), 1, 99);
}

function freshFitness(center: number, rng: Rng): Fitness {
  const c = clamp(center, 10, 85);
  return {
    aerobicBase: attr(rng, c, 6),
    lactate: attr(rng, c - 3, 7),
    vo2: attr(rng, c - 5, 8),
    sharpness: attr(rng, c - 15, 8),
    fatigue: rng.int(5, 20),
    acuteLoad: 20,
    chronicLoad: 20,
    champPrep: 0,
    peakWeek: 0,
  };
}

/** Star rating → attribute center. */
function centerForStars(stars: number): number {
  return 30 + stars * 10; // 1★≈40 … 5★≈80
}

export interface GenAthleteOpts {
  stars?: 1 | 2 | 3 | 4 | 5;
  international?: boolean;
  classYear?: ClassYear;
  /** talent center override (0–99) */
  center?: number;
}

export function generateAthlete(rng: Rng, opts: GenAthleteOpts = {}): Athlete {
  const stars = opts.stars ?? (rng.weighted([1, 2, 3, 4, 5], [12, 28, 35, 18, 7]) as 1 | 2 | 3 | 4 | 5);
  const international = opts.international ?? rng.chance(0.18);
  const center = opts.center ?? centerForStars(stars);

  const firstName = rng.pick(FIRST_NAMES);
  const lastName = rng.pick(LAST_NAMES);

  let hometown: string, country: string;
  if (international) {
    const [c, town] = rng.pick(INTL_ORIGINS);
    country = c;
    hometown = town;
  } else {
    country = "USA";
    hometown = rng.pick(US_HOMETOWNS);
  }

  const attrs: Attributes = {
    aerobic: attr(rng, center + 2),
    threshold: attr(rng, center),
    speed: attr(rng, center - 2),
    hills: attr(rng, center - 2),
    durability: attr(rng, center - 4, 11),
    raceIQ: attr(rng, center - 6, 12),
    consistency: attr(rng, center - 4, 12),
    morale: attr(rng, 65, 10),
  };

  // Internationals skew older/more developed but higher injury variance.
  const hidden: HiddenAttributes = {
    potential: clamp(Math.round(rng.gauss(center + (international ? 6 : 10), 12)), center, 99),
    injuryProneness: attr(rng, international ? 48 : 42, 16),
    bigMeetTemperament: attr(rng, 50, 16),
  };

  const classYear: ClassYear = opts.classYear ?? rng.pick(["FR", "SO", "JR", "SR"] as ClassYear[]);
  const eligLeft = { FR: 4, SO: 3, JR: 2, SR: 1, "5TH": 1, GRAD: 1 }[classYear];

  return {
    id: uid("ath", rng),
    firstName, lastName, hometown, country, international,
    classYear, eligibilityLeft: eligLeft, redshirtUsed: classYear !== "FR" && rng.chance(0.15),
    attrs, hidden, revealed: {},
    fitness: freshFitness(center, rng),
    status: { kind: "healthy" },
    nil: Math.round(stars * rng.float(2, 10)),
    portalRisk: rng.int(5, 30),
    starRating: stars,
  };
}

/** A full roster for a program of the given prestige (1–99). */
export function generateRoster(rng: Rng, prestige: number, size = 14): Athlete[] {
  const roster: Athlete[] = [];
  // prestige shifts the star distribution upward
  const tilt = clamp((prestige - 50) / 50, -1, 1);
  for (let i = 0; i < size; i++) {
    const stars = clamp(
      Math.round(rng.gauss(2.6 + tilt * 1.4, 1.0)), 1, 5
    ) as 1 | 2 | 3 | 4 | 5;
    const classYear = rng.weighted(
      ["FR", "SO", "JR", "SR", "5TH"] as ClassYear[],
      [26, 24, 22, 20, 8]
    );
    roster.push(generateAthlete(rng, { stars, classYear }));
  }
  return roster;
}

/** A recruit wrapping a generated athlete. */
export function generateRecruit(rng: Rng, kind: RecruitKind): Recruit {
  const opts: GenAthleteOpts =
    kind === "international"
      ? { international: true, classYear: "FR", stars: rng.weighted([2, 3, 4, 5], [20, 35, 30, 15]) as 2 | 3 | 4 | 5 }
      : kind === "transfer"
      ? { classYear: rng.pick(["SO", "JR", "SR"] as ClassYear[]) }
      : { international: false, classYear: "FR" };
  const athlete = generateAthlete(rng, opts);
  return {
    id: uid("rec", rng),
    athlete,
    kind,
    starRating: athlete.starRating,
    interest: {},
    competingOffers: rng.int(0, 8),
    scouted: 0,
    signedBy: null,
  };
}
