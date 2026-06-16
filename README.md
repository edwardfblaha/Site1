# Harrier

**The athlete-first performance database for college cross country.**

National rankings for NCAA cross country athletes and teams, built from
**head-to-head results** — who beat whom across every XC race and track 5k/10k —
not from converting performances into fake-slow "5k equivalent" times.

> Look yourself up, watch your rating climb, and send the screenshot to your teammates.

## What it does

- **National athlete rankings** (men & women) from a head-to-head rating model.
- **Athlete profiles** — rating, national rank, win–loss record, win rate,
  season trajectory, signature wins, notable losses, full race log, head-to-head
  vs. nearby athletes, and teammates.
- **Team rankings** — top-5 scoring with a top-7 depth figure.
- **Race pages** — full finishing order with gaps.
- **Instant search** across athletes and teams.
- **Transparent methodology** page explaining exactly how a ranking is built.

The interface is dark, fast, mobile-friendly, and made to be fun to browse.

## Run it

No build step. It's static files:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## How it works

- `index.html` — shell + nav + search.
- `styles.css` — the visual design.
- `data.js` — the dataset (demo data; swap for `real_data.js`, see below).
- `engine.js` — the head-to-head rating engine (see `METHODOLOGY.md`).
- `app.js` — the single-page app (hash-routed views).

The demo ships with **synthetic data** so every page is explorable immediately.
It's clearly labeled and is **not** official results.

## The ranking method (short version)

Every race is a bracket of matchups: the winner beats everyone behind them,
second beats everyone behind them, and so on. Harrier records all of those
pairwise results — across cross country **and** track 5k/10k — weights them by
recency and margin, and solves a single national rating per gender so that
rating gaps best explain every head-to-head result at once. Beating someone who
beats the top names lifts you, even if you never raced them directly. **No
time-equivalence anywhere.** Full write-up in [`METHODOLOGY.md`](METHODOLOGY.md).

## Using real TFRRS data

You don't scrape the whole site — you import the result pages you need.

1. Put TFRRS meet **result-page URLs** (one per line) in `import/meets.txt`.
   Browse <https://www.tfrrs.org/>, open a meet's results page, copy the URL.
   Cross country **and** track 5k/10k meets both work.
2. (Recommended) install a parser: `npm i node-html-parser`
3. Run the importer:
   ```bash
   node import/tfrrs_import.mjs
   ```
   It politely fetches (rate-limited + cached in `import/.cache/`) and writes
   `real_data.js`.
4. In `index.html`, replace `<script src="data.js?v=...">` with
   `<script src="real_data.js">`. The engine and UI work unchanged.

**Be a good citizen:** keep the request delay, cache responses, set a real
contact in the importer's `USER_AGENT`, and review TFRRS's terms before any
large pull.

## Roadmap

The shipped engine is the fast linear core of the full design. Next steps
(in `METHODOLOGY.md`): calibrated **win probabilities**, a **meet simulator**,
**credible intervals** for sparse athletes, and a **"why is X ranked above Y"**
transparency panel.
