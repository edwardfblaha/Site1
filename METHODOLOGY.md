# Harrier Ranking Methodology

A head-to-head ranking system for NCAA Division I cross country — built so that
rankings come from **who beat whom**, across every XC race and track 5k/10k,
rather than from converting performances into equivalent 5k times.

This document answers the design brief in seven parts: candidate methods, their
trade-offs, the recommended method, precise math, a production design, a
validation plan, and innovative extensions. The live demo on this site
implements a simplified version of the recommended method (see "What the demo
runs" at the end).

---

## Part 1 — Candidate methodologies

1. **Elo (with margin & recency variants).** Sequential pairwise updates after
   each race; rating moves by `K · (S − E)`.
2. **Glicko-2.** Elo plus a *rating deviation* (RD) and *volatility* — explicit
   uncertainty, ideal for athletes with few races.
3. **Bradley–Terry / Plackett–Luce (full-field MLE).** A probabilistic model of
   finishing *orders* (not just pairs); maximum-likelihood strengths.
4. **Massey / least-squares margin model.** Solve a linear system so rating
   differences best explain head-to-head margins; transitive by construction.
5. **PageRank / network-flow ("beat-power").** Treat "A lost to B" as a link;
   stationary distribution of a random walk over the win graph.
6. **Bayesian hierarchical state-space model (recommended core).** Latent
   ability per athlete that **drifts over the season**, observed through
   full-field race orders with margin information and course random effects.

---

## Part 2 — Strengths, weaknesses, cost, interpretability

| Method | Strengths | Weaknesses | Cost | Interpretability |
|---|---|---|---|---|
| **Elo** | Simple, online, recency natural via K | Path-dependent; ignores indirect chains within a race; margin is a hack | O(matchups), trivial | High ("rating points") |
| **Glicko-2** | Models uncertainty (RD), good for sparse racing | Pairwise at heart; full XC fields need decomposition | Low | High (rating ± RD) |
| **Bradley–Terry / Plackett–Luce** | Uses the *whole* finishing order; principled probabilities; indirect strength via joint MLE | Static unless extended; needs regularization on sparse graphs; no margin by default | Medium (iterative MLE) | Medium |
| **Massey (least squares)** | Transitive (A>B>C ⇒ A>C); margins native; one clean linear solve | Margin in *time* conflates course/conditions; assumes symmetric, additive strength | Low (sparse linear solve) | Medium-high (rating = expected margin) |
| **PageRank** | Captures indirect connectivity beautifully; robust to weird schedules | Hard to attach margins; "rating" is abstract; tuning damping is fiddly | Low | Low-medium |
| **Bayesian hierarchical state-space** | Everything at once: full order, margins, **seasonal drift**, **uncertainty**, course/weather random effects; native simulation | Most complex; needs MCMC or variational fitting; careful priors | High (but weekly batch is fine) | Medium (credible intervals help) |

---

## Part 3 — Recommendation

**Primary: a Bayesian hierarchical state-space model with a Plackett–Luce
(rank-order) likelihood, margin-informed observations, seasonal ability drift,
and course/conditions random effects.** It is the only candidate that
simultaneously satisfies every objective in the brief — indirect inference,
margins, recency, uncertainty, and native race simulation.

**Production-pragmatic core: a margin-weighted, recency-weighted, ridge-
regularized Massey/Bradley–Terry hybrid**, used as (a) the fast weekly ranking
and (b) the initialization for the full Bayesian fit. This is what makes the
system shippable and explainable while the Bayesian layer adds calibrated
probabilities. The live demo implements this core.

Rationale: Massey gives transitivity and margins in one sparse linear solve;
Bradley–Terry/Plackett–Luce supplies proper win probabilities; the Bayesian
state-space wrapper adds the season-long drift and uncertainty that cross
country specifically needs. Together they avoid all time-equivalence.

---

## Part 4 — Precise mathematical definition

### Inputs
- Athletes `i = 1…N` (per gender, ranked separately).
- Races `r = 1…R`, each with finishers ordered by time, times `t_{i,r}`,
  date `d_r`, type (XC 8k/6k, track 5k/10k), and course/venue `c_r`.

### Latent variables
- `θ_i(τ)` — athlete `i`'s **ability at time τ** (higher = faster). The unit is
  log-pace, so differences are scale-free across distances.
- `γ_c` — course/venue random effect (difficulty/idiosyncrasy), `γ_c ~ N(0, σ_c²)`.
- `σ_i²` — posterior variance of `θ_i` (the uncertainty / "RD").

### Observation model (per race)
Convert each finish to a **pace residual** `y_{i,r} = log(t_{i,r} / L_r)` where
`L_r` is race distance, removing distance so XC and track are comparable as
*efforts*, **not** as converted times. The race likelihood is **Plackett–Luce
on the order**, with a margin term:

- Order likelihood: `P(order_r) = ∏_k  exp(η_{(k)}) / Σ_{j≥k} exp(η_{(j)})`,
  where `η_{i} = α·θ_i(d_r) − γ_{c_r}` and `(k)` is the k-th finisher.
- Margin refinement: between adjacent (and all pairwise) finishers, the observed
  standardized gap `Δ_{ij,r} = (y_{j,r} − y_{i,r})` is modeled
  `Δ_{ij,r} ~ N(θ_i(d_r) − θ_j(d_r), ρ_r²)`. The **race noise `ρ_r`** is larger
  for tactical races (small spread at the front) and smaller for fast races, so
  *blowouts inform more than tactical jostling*.

### Seasonal drift (state equation)
Ability follows a Gaussian random walk between an athlete's races:
`θ_i(d_{next}) = θ_i(d_{prev}) + ε,  ε ~ N(μ_improve, σ_drift²·Δdays)`.
A small positive `μ_improve` encodes typical in-season fitness gains; `σ_drift`
controls how fast the rating can move.

### Recency & margin weighting (used in the linear core)
- **Recency:** race weight `w_r = exp(−(D_now − d_r)/H)` with half-life `H`
  (e.g. 21–28 days), optionally multiplied by a championship importance factor.
- **Margin weight** for a pair: `m_{ij,r} = clip(β·Δ_{ij,r} + m₀, m_min, 1)` so
  larger (but not absurd) gaps count as stronger evidence; capped to resist
  outliers and late-race blowups.

### The fast linear core (weekly ranking + init)
Stack every within-race pairwise comparison into a ridge-regularized weighted
least-squares (Massey) system for the rating vector `R` (a snapshot of `θ`):

```
(MᵀW M + λI) R = MᵀW b
```

- Each comparison `i beat j` contributes a row of `M` with `+1` at `i`, `−1` at
  `j`; the target `b` is the standardized margin; `W = diag(w_r · m_{ij,r})`.
- `λ` (ridge) pulls weakly-connected athletes toward the mean and guarantees a
  unique solution on sparse graphs.
- **Transitivity is automatic:** if A beats B and B beats C, the normal
  equations propagate strength from C through B to A even with no A–C race.

### Rating scale (display)
Standardize `R` within gender and map to a friendly score:
`Harrier = clip(72 + 13·(R − mean)/sd, 1, 100)`. Ranks are by raw `R`.

### Uncertainty
From the Bayesian fit, report `θ_i ± 1.96·σ_i`. In the linear core, approximate
`σ_i²` from the diagonal of `(MᵀW M + λI)⁻¹` — athletes with few, weakly
connected races get wider intervals and are flagged "provisional."

---

## Part 5 — Production design (weekly, all D1 men & women)

1. **Ingest (TFRRS).** Nightly pull of new meet result pages → normalized
   `(athlete, team, race, time, place)` rows. (See `import/tfrrs_import.mjs`.)
   Entity-resolve athletes across name/team/transfer changes via TFRRS athlete
   IDs.
2. **Build the comparison graph** per gender from all XC + track 5k/10k results
   in a rolling window (e.g. 13 months, so spring track informs fall XC).
3. **Weekly batch fit:**
   - (a) Solve the ridge Massey/BT core for the published ranking (seconds).
   - (b) Warm-start the hierarchical state-space model; fit by variational
     inference (fast) or HMC/NUTS (gold standard) for calibrated posteriors.
4. **Publish:** athlete ratings + ranks + records + credible intervals; team
   ratings = mean of top-5 (depth = top-7); "provisional" badges for sparse
   athletes.
5. **Simulate** upcoming meets (Part 7) from the posterior.
6. **Versioning & stability controls:** freeze weekly snapshots; damp
   week-to-week rank churn with a small anchor toward last week unless new
   results justify the move.

Compute: the linear core is a sparse solve over ~tens of thousands of athletes —
sub-second to seconds. The Bayesian layer is embarrassingly parallel per gender
and runs comfortably in a weekly batch.

---

## Part 6 — Validation against historical NCAA data

- **Predictive accuracy (out-of-sample).** Train on races up to week *k*,
  predict head-to-head outcomes in week *k+1*. Report pairwise accuracy, log-loss,
  and Brier score vs. baselines (a) raw season-best 5k-equivalent, (b) Elo,
  (c) last result.
- **Calibration.** Reliability curves: of matchups predicted at 70%, ~70% should
  occur. Critical for the probability claims.
- **Race-simulation accuracy.** Simulate championship meets; compare predicted
  team-score distributions and individual top-10 probabilities to actual; score
  with CRPS.
- **Ranking stability.** Measure week-to-week rank churn and sensitivity to
  removing a single race; penalize volatility not justified by new information.
- **Head-to-head against incumbents.** Backtest the same weeks against existing
  time-conversion rankings; the win condition is materially better next-week
  prediction and calibration.

Target: beat the best time-conversion baseline on next-week pairwise log-loss by
a meaningful margin, with well-calibrated probabilities.

---

## Part 7 — Innovative features that beat existing systems

1. **Win probabilities, not just ranks.** "Syracuse 17% to win, 41% podium, 89%
   top-10" — the FiveThirtyEight move, powered by the posterior.
2. **Meet simulator.** Enter a field + course; get team-score distributions and
   individual top-N probabilities.
3. **Strength-of-schedule & connectivity.** Flag athletes whose rating is
   uncertain because their race graph is weakly connected — and show *who they'd
   need to race* to resolve it.
4. **"Why" panels (transparency).** For any ranking gap, surface the actual
   results driving it ("ranked above X because of head-to-head wins over Y, Z who
   beat X").
5. **Tactical-vs-fast race detection.** Auto-down-weight margins in slow,
   bunched races; up-weight honest, spread-out racing.
6. **Course fingerprints as a *byproduct*, not an input.** Estimate venue
   effects `γ_c` from residuals for context — without ever ranking by converted
   times.
7. **Athlete trajectory & peaking models.** Use the seasonal drift to project
   each athlete's championship-week ability with intervals.
8. **Transfer & multi-year tracking.** Persistent athlete identity across teams
   and seasons; career performance-rating history like sports-reference.

---

## What the demo on this site runs

The live pages implement **Part 4's fast linear core**: every race is expanded
into within-race pairwise comparisons, weighted by recency and margin, and
solved as a ridge-regularized Massey system per gender (`engine.js`). Track
5k/10k results are folded in as additional head-to-head evidence. This yields
the national rankings, win–loss records, signature wins/notable losses, and
team ratings you see — with **no time-equivalence anywhere**. The Bayesian
state-space layer (probabilities, simulations, credible intervals) is the
designed next step and is where the "better than the incumbents" claims are
won.
