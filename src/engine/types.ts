/**
 * Domain types for Cross Country Manager.
 * Pure data — no React, no DOM. Shared by engine, CLI, and UI.
 */

// ---------- Identity / league ----------
export type RegionId =
  | "northeast" | "midatlantic" | "southeast" | "greatlakes" | "heartland"
  | "southcentral" | "mountain" | "west" | "pacific";

export type ConferenceId = string; // fictional conf ids, defined in programs.json

export interface ProgramDef {
  id: string;
  name: string;            // fictionalized (no real school/mascot/logo)
  colorPrimary: string;    // hex, identifier
  colorSecondary?: string;
  region: RegionId;
  conference: ConferenceId;
  prestige: number;        // 1–99 starting prestige
  isTop50: boolean;
}

// ---------- Athlete ----------
export type ClassYear = "FR" | "SO" | "JR" | "SR" | "5TH" | "GRAD";

export interface Attributes {
  aerobic: number;      // aerobic endurance
  threshold: number;    // lactate threshold
  speed: number;        // speed / kick
  hills: number;        // hills / terrain
  durability: number;   // injury resistance (visible proxy)
  raceIQ: number;       // pacing / tactics
  consistency: number;  // narrower outcome spread when high
  morale: number;       // 1–99, dynamic
}

export interface HiddenAttributes {
  potential: number;          // true ceiling
  injuryProneness: number;    // higher ⇒ more injuries
  bigMeetTemperament: number; // championship nerve
}

/** Four trainable physiological systems + load state. 0–99 scale. */
export interface Fitness {
  aerobicBase: number;   // slow build/decay — long runs, base volume
  lactate: number;       // medium — threshold work
  vo2: number;           // fast — intervals
  sharpness: number;     // fastest, decays in weeks — race-specific/sharpening
  fatigue: number;       // 0–99, acute load; freshness derives from this
  acuteLoad: number;     // rolling ~7-day load
  chronicLoad: number;   // rolling ~28-day load (ACWR = acute/chronic)
  champPrep: number;     // season-long intensity dose → championship readiness
  peakWeek: number;      // calendar week sharpness is trending to peak
}

export type AthleteStatus =
  | { kind: "healthy" }
  | { kind: "niggle"; weeksLeft: number }
  | { kind: "injured"; weeksLeft: number; severity: "minor" | "moderate" | "major" }
  | { kind: "redshirt" }
  | { kind: "overtrained"; weeksLeft: number };

export interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
  hometown: string;
  country: string;       // "USA" or foreign
  international: boolean;
  classYear: ClassYear;
  eligibilityLeft: number;    // seasons of eligibility remaining
  redshirtUsed: boolean;
  attrs: Attributes;
  hidden: HiddenAttributes;
  revealed: Partial<Record<keyof HiddenAttributes, boolean>>; // scouting-gated knowledge
  fitness: Fitness;
  status: AthleteStatus;
  nil: number;           // current NIL allotment ($k)
  portalRisk: number;    // 0–99 likelihood of entering the portal in offseason
  starRating: 1 | 2 | 3 | 4 | 5; // recruiting rating snapshot
}

// ---------- Coach / staff ----------
export type Philosophy =
  | "lydiard" | "balanced" | "intensity" | "altitude" | "norwegian";

export type StaffTier = 0 | 1 | 2 | 3;
export interface Staff {
  assistant: StaffTier;
  sportsScientist: StaffTier;  // reveals hidden attrs, lowers injury
  recruitingCoordinator: StaffTier;
}

export interface Coach {
  name: string;
  reputation: number;  // 1–99
  xp: number;
  philosophy: Philosophy;
  unlocked: Philosophy[];
  staff: Staff;
}

// ---------- Economy ----------
export interface Investments {
  shoeTier: StaffTier;            // 0 none … 3 top carbon-plate
  shoeLifeRacesLeft: number;      // depreciates per race
  recoveryTech: 0 | 1 | 2;        // boots/sauna etc.
  lab: boolean;                   // enables precise lactate testing
  altitudeTent: boolean;
}

export interface Consumables {
  gels: number;               // units in stock
  bicarb: number;
  bicarbProtocol: boolean;    // practiced protocol ⇒ low GI risk
  recoveryNutrition: number;
  medical: number;
}

export interface Budget {
  // preseason capital allocation (set in offseason)
  nilPool: number;
  domesticRecruiting: number;
  internationalRecruiting: number;
  officialVisits: number;
  media: number;
  staffSpend: number;
  summerCamp: number;
  travel: number;
  // ongoing in-season operations
  operationsPot: number;
  investments: Investments;
  consumables: Consumables;
}

// ---------- Program ----------
export interface Program {
  def: ProgramDef;
  prestige: number;        // evolves over time
  roster: Athlete[];
  coach: Coach;
  budget: Budget;
  seasonExpectation: number; // AD's target finish bucket (lower = better)
  aiPhilosophy: Philosophy;  // for AI-run programs
  isPlayer: boolean;
}

// ---------- Meets / races ----------
export interface CourseProfile {
  distance: 8000 | 10000;
  terrain: number;   // 0 flat … 1 very hilly
  firmness: number;  // 0 soft/muddy … 1 firm/fast (affects shoe benefit)
  altitude: number;  // meters
}

export type MeetTier = "regular" | "conference" | "regional" | "national";

export interface Meet {
  id: string;
  name: string;         // geographic, fictional
  tier: MeetTier;
  week: number;
  prestige: number;     // field quality / reputation
  travelCost: number;
  course: CourseProfile;
}

export interface RunnerResult {
  athleteId: string;
  programId: string;
  splits: number[];     // seconds at 2k, 5k, (8k), finish
  timeSec: number;
  place: number;        // overall individual place
  scoringPlace: number; // place counted for team scoring (0 if non-scorer)
  notes: string[];      // model-derived explanations
}

export interface TeamScore {
  programId: string;
  score: number;         // sum of top-5 scoring places
  scorers: string[];     // athlete ids, top 5
  displacers: string[];  // 6th/7th
  sixthRunnerPlace: number; // tiebreak
  teamPlace: number;
}

export interface RaceResult {
  meetId: string;
  week: number;
  runners: RunnerResult[];
  teamScores: TeamScore[];
}

// ---------- Training ----------
export type TrainingBlock =
  | "base" | "threshold" | "vo2" | "longRun" | "raceSpecific" | "sharpening" | "taper";
export type VolumeLevel = "low" | "med" | "high";

export interface TrainingChoice {
  block: TrainingBlock;
  volume: VolumeLevel;
  hillEmphasis: boolean; // hard running uphill ⇒ lower injury for same stimulus
}

// ---------- Season / game state ----------
export type SeasonPhase =
  | "offseason" | "summer" | "august" | "regular" | "championships" | "complete";

export interface SeasonRecord {
  year: number;
  programId: string;
  finishNational: number | null;
  conferenceFinish: number | null;
  regionalFinish: number | null;
}

export interface GameState {
  version: number;
  seed: number;
  rngCursor: number;
  year: number;
  phase: SeasonPhase;
  week: number;
  playerProgramId: string;
  programs: Program[];
  schedule: Meet[];
  results: RaceResult[];
  history: SeasonRecord[];
  pendingEventIds: string[];
  log: string[];
}

// ---------- Recruiting (types now; logic in later phase) ----------
export type RecruitKind = "hs" | "international" | "transfer";
export interface Recruit {
  id: string;
  athlete: Athlete;        // underlying generated athlete
  kind: RecruitKind;
  starRating: 1 | 2 | 3 | 4 | 5;
  interest: Record<string, number>; // programId → interest 0–99
  competingOffers: number;
  scouted: number;         // 0–1, narrows attribute uncertainty
  signedBy: string | null;
}
