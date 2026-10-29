/**
 * ★ The single source of tunable constants for the whole game.
 * Injury rates, training effects, costs, formula weights — all here, so the
 * headless simulator can be used to balance the game by editing one file.
 */
import type { TrainingBlock, VolumeLevel, Philosophy } from "../engine/types";

export const BALANCE = {
  // ---------- Race model ----------
  race: {
    base: 1.15,
    readinessWeight: 0.6,   // readiness vs course-fit split in perf
    fitWeight: 0.4,
    pacingWeight: 0.05,     // Race IQ contribution
    temperWeight: 0.06,     // big-meet temperament (champ tiers only)
    champPrepWeight: 0.08,  // championship under-preparation penalty (champ tiers)
    noiseScale: 0.05,       // seeded outcome noise, scaled down by consistency
    consistencyDamp: 0.7,   // how much consistency narrows noise
    spread: 0.28,           // perf→time spread (fraction of par)
    topPerf: 0.98,          // perf that maps to par (winner reference)
    packMax: 0.015,         // max shared boost for a tight pack
    packRefSpreadSec: 40,   // gap over top-5 at which pack boost → 0
    shoeBonusMax: 0.012,    // carbon plate max perf gain (×tier, ×firmness)
    gelFadeReduction: 0.5,  // fraction of late-race fade removed when fueled
    bicarbKick: 0.02,       // champ-tier kick/threshold boost when deployed
    bicarbGiRisk: 0.25,     // P(GI event) if no practiced protocol
    // course par times (sec) the perf maps onto, per distance
    par: { 8000: 1420, 10000: 1800 } as Record<number, number>,
    // attribute weights by distance/terrain (normalized internally)
    fitWeights: {
      flat8k:  { aerobic: 0.8, threshold: 1.1, speed: 1.0, hills: 0.4, durability: 0.6 },
      hilly10k:{ aerobic: 1.2, threshold: 1.0, speed: 0.6, hills: 1.1, durability: 1.0 },
    },
  },

  // ---------- Fitness systems: per-week build/decay ----------
  fitness: {
    // natural weekly decay toward 0 if untrained
    decay: { aerobicBase: 0.004, lactate: 0.02, vo2: 0.05, sharpness: 0.12 },
    ceilingWeights: { aerobicBase: 0.6, lactate: 0.4 }, // → race "ceiling"
    sharpnessWeights: { vo2: 0.55, sharpnessSys: 0.45 }, // → race "sharpness"
    fatigueCap: 99,
    restShed: 6,       // fatigue shed per easy week
    taperShed: 16,     // fatigue shed per taper week
    acwrWindow: { low: 0.8, high: 1.4 }, // safe acute:chronic band
    champPrepTarget: 60, // season-long VO2+raceSpecific dose needed for champs
  },

  // ---------- Training blocks: effect vectors (per med-volume week) ----------
  // gains to each system, fatigue cost, intensity (for ACWR/burnout), and the
  // calendar window where the block pays full value (1 = peaks for November).
  blocks: {
    base:         { aerobicBase: 2.2, lactate: 0.4, vo2: 0.0, sharpness: 0.0, fatigue: 3, intensity: 0.3, champPrep: 0,  peakBias: 0.2 },
    longRun:      { aerobicBase: 2.6, lactate: 0.5, vo2: 0.0, sharpness: 0.0, fatigue: 5, intensity: 0.4, champPrep: 0,  peakBias: 0.2 },
    threshold:    { aerobicBase: 0.8, lactate: 2.4, vo2: 0.4, sharpness: 0.2, fatigue: 6, intensity: 0.6, champPrep: 6,  peakBias: 0.5 },
    vo2:          { aerobicBase: 0.2, lactate: 0.9, vo2: 2.6, sharpness: 0.8, fatigue: 11, intensity: 0.95, champPrep: 14, peakBias: 0.8 },
    raceSpecific: { aerobicBase: 0.2, lactate: 0.9, vo2: 1.2, sharpness: 2.2, fatigue: 9, intensity: 0.85, champPrep: 12, peakBias: 0.95 },
    sharpening:   { aerobicBase: 0.0, lactate: 0.3, vo2: 0.6, sharpness: 2.6, fatigue: 7, intensity: 0.8, champPrep: 6,  peakBias: 1.0 },
    taper:        { aerobicBase: 0.0, lactate: 0.2, vo2: 0.2, sharpness: 0.8, fatigue: -1, intensity: 0.2, champPrep: 2, peakBias: 1.0 },
  } satisfies Record<TrainingBlock, Record<string, number>>,

  volumeMult: { low: 0.65, med: 1.0, high: 1.4 } satisfies Record<VolumeLevel, number>,

  // ---------- Philosophy modifiers ----------
  philosophy: {
    lydiard:   { label: "Lydiard (high volume)", aerobicMult: 1.25, intensityMult: 0.85, injuryMult: 1.1, peakSharpness: 0.95, unlockRep: 0 },
    balanced:  { label: "Balanced",              aerobicMult: 1.0,  intensityMult: 1.0,  injuryMult: 1.0, peakSharpness: 1.0,  unlockRep: 0 },
    intensity: { label: "Intensity-first",       aerobicMult: 0.85, intensityMult: 1.25, injuryMult: 1.25, peakSharpness: 1.05, unlockRep: 35 },
    altitude:  { label: "Altitude",              aerobicMult: 1.15, intensityMult: 0.95, injuryMult: 0.95, peakSharpness: 1.0,  unlockRep: 50 },
    norwegian: { label: "Norwegian double threshold", aerobicMult: 1.05, intensityMult: 1.08, injuryMult: 0.96, peakSharpness: 1.05, unlockRep: 70, needsLab: true },
  } satisfies Record<Philosophy, Record<string, unknown>>,

  // ---------- Injury / burnout ----------
  injury: {
    base: 0.018,                 // weekly baseline
    acwrSpikePenalty: 2.5,       // multiplier when ACWR above safe band
    fatiguePenalty: 1.0,         // + fatigue/cap
    durabilityRelief: 0.6,       // high durability reduces risk
    terrainMult: { uphill: 0.6, flat: 1.0 }, // hard hill reps safer than flat
    medicalRelief: 0.4,          // max relief from medical supplies/staff
    burnoutBase: 0.01,
    burnoutIntensityWeeks: 4,    // sustained high intensity window that triggers
    weeksOut: { minor: [1, 2], moderate: [3, 6], major: [7, 14] } as Record<string, [number, number]>,
  },

  // ---------- Development (offseason, per year) ----------
  development: {
    growth: 3.2,
    ageCurve: { FR: 1.3, SO: 1.15, JR: 0.9, SR: 0.55, "5TH": 0.4, GRAD: 0.3 } as Record<string, number>,
    healthPenalty: 0.5,   // injured seasons cut growth
    moraleScale: 0.4,
  },

  // ---------- Economy: saturating returns effect = max*spend/(spend+K) ----------
  economy: {
    // K sets diminishing-returns midpoint ($k); max is the ceiling effect.
    nil:        { max: 0.9, k: 120 },
    domestic:   { max: 0.8, k: 90 },
    intl:       { max: 0.8, k: 140 },
    media:      { max: 0.6, k: 80 },
    visits:     { max: 0.7, k: 6 },   // in slots
    camp:       { max: 0.12, k: 60 }, // fitness dev boost
    labTestCostPerCycle: 8,
    bicarbProtocolCost: 25,
    shoeTierCost: [0, 20, 45, 80],    // $k by tier
    shoeLifeRaces: [0, 4, 6, 9],      // races before replacement by tier
    budgetByPrestige: { base: 150, perPrestige: 9 }, // annual $k = base + prestige*per
  },

  // ---------- Recruiting signing logistic coefficients ----------
  recruiting: {
    beta0: -1.2, interest: 0.04, prestigeGap: 0.03, nil: 0.5, visit: 0.35,
    media: 0.3, rep: 0.025, competing: 0.4, recruitBudget: 0.6,
    poolSizeHS: 320, poolSizeIntl: 70, poolSizeTransfer: 90,
    rosterLimit: 18,
  },

  // ---------- Championship structure ----------
  champs: {
    regions: 9,
    autoQualPerRegion: 2,
    atLargeBids: 13,
    nationalsTeams: 31,
  },
} as const;

export type Balance = typeof BALANCE;
