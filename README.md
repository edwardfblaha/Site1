# Cross Country Manager

A single-player college cross country management game (working title). You are
the head coach of a Division I-style men's program making coaching, training,
recruiting, and budget decisions across multi-season careers. **No backend** —
a static web app that runs entirely in the browser.

> Fully fictionalized: no real school names, mascots, logos, conferences, meets,
> or athletes. Programs are named after their state/city/region and identified
> by a color; athletes are procedurally generated.

## Tech

- **TypeScript + React + Vite**, **Tailwind** UI, deploys to **GitHub Pages**.
- Strict separation: a pure, DOM-free simulation **engine** in `src/engine`, UI
  in `src/ui`. The engine is unit-tested with **Vitest**.
- **Seeded, deterministic RNG** — same seed + same decisions ⇒ same results.
- Saves to `localStorage` with JSON export/import (added in a later phase).

## Scripts

```bash
npm install
npm run dev                      # local dev server
npm test                         # engine unit tests (Vitest)
npm run build                    # typecheck + production build
npm run simulate -- --seasons 200   # headless balance simulator
npm run gen:programs             # regenerate src/data/programs.json
```

## Layout

```
src/
  engine/     pure simulation (rng, types, athletes, league, …) — no React/DOM
  config/     balance.ts — ALL tunable constants in one file
  data/       programs.json — ~180 fictional teams (hand-editable source of truth)
  ui/         React + Tailwind screens/components
scripts/      simulate.ts (CLI), gen-programs.mjs (program generator)
test/         Vitest suites
```

## Status — build is phased

1. ✅ **Phase 1:** scaffold, types, seeded RNG, athlete generator, `programs.json`.
2. ✅ **Phase 2:** race simulation + XC scoring + tests.
3. ✅ **Phase 3:** training/periodization, season calendar, championship path (Kolas at-large).
4. ✅ **Phase 4:** core UI (new game, season/training, roster, rankings, recruiting, budget, offseason).
5. ✅ **Phase 5:** economy, budget, staff, recruiting, portal, offseason.
6. ✅ **Phase 6:** narrative events, coach career, AI coaches, save/load (localStorage + JSON export/import).
7. ✅ **Phase 7:** balance pass via the headless simulator — see [`BALANCE.md`](BALANCE.md).

Play it: pick a program, train a periodized season, set lineups at meets, chase
nationals, then recruit and manage your budget in the offseason — across seasons.
Autosaves to the browser; export/import JSON from the sidebar.

## Deploying to GitHub Pages

`vite.config.ts` sets `base: '/Site1/'`. The site is published to the `gh-pages`
branch; enable Pages (Settings → Pages → Deploy from a branch → `gh-pages` / root).
For a custom domain set `VITE_BASE=/`.
