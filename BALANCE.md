# Balance report (Phase 7)

Generated with the headless simulator: `npm run simulate -- --seasons 40`.
All constants live in `src/config/balance.ts`; re-run after any edit.

## Findings (40 seasons, seed 2026)

| Signal | Result | Read |
|---|---|---|
| Distinct national champions | 11 | Healthy parity, not a monopoly |
| Champion concentration (HHI) | ~0.12 | Strong programs win more, but the title moves around |
| Podium share from preseason top-50 programs | ~100% | Talent clearly matters (the earlier "filler team 2nd" bug is gone) |
| Injuries | ~0.86 per 1000 athlete-weeks | Present and meaningful, not catastrophic |

## Tunings applied

- **Talent stratification** (`training.ts`): fitness systems are capped and gain-scaled by an athlete's hidden potential, so a full season of training no longer flattens talent gaps. This fixed weak programs occasionally finishing on the national podium.
- **Injury base** raised `0.012 → 0.018` so injuries register in long careers.
- **Norwegian philosophy** softened (`peakSharpness 1.10→1.05`, `injuryMult 0.90→0.96`) so it's strong but not an automatic win.

## Known confound (not a bug)

Average national finish **by philosophy** shows Norwegian best (~33) and Lydiard
worst (~42). This is largely a *selection effect*: Norwegian unlocks only at coach
reputation ≥ 70 (and needs a lab), so only elite programs run it — the number
reflects *who adopts it*, not a pure strategy edge. A proper "no dominant
strategy" test holds the program fixed and varies only the philosophy; that
controlled experiment is the recommended next balance step. Lydiard remains a
valid high-floor / lower-ceiling option for rebuilding programs.

## Suggested future tuning levers

- Controlled philosophy A/B (same cloned programs, different philosophy).
- Economy A/B: confirm no single budget allocation dominates (saturating returns
  are in place via `effect = max·spend/(spend+K)`).
- Injury severity mix and portal-departure rates over 10+ season careers.
