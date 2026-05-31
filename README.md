# base

**Training plans for elite runners.** A clean, highly visual planner for building
a full training block — week by week, day by day.

![base](https://img.shields.io/badge/status-ready-3aa0ff)

## What it does

`base` lets an athlete lay out a multi-week training block on a colour-coded
calendar and see the shape of the plan at a glance:

- **Daily mileage** with running weekly totals and a volume bar for every week.
- **Daily runs** with free-text notes (paces, reps, routes).
- **Workout types**, each with its own distinct colour:
  - 🔵 Easy &nbsp; 🟣 Long &nbsp; 🟠 Tempo &nbsp; 🟧 Threshold &nbsp; 🔴 VO2 &nbsp; 🟥 Anaerobic &nbsp; ⚫ Rest
- **Modifiers** you can flag on any day:
  - 🟢 **Strides** &nbsp; 🟡 **Hill sprints** &nbsp; 🔵 **Double**
- **Plan summary**: total volume, average week, peak week, and quality-session count.
- **Miles or km**, any start Monday, 1–52 weeks.
- **Export / import** plans as JSON, and autosave to the browser.

The interface is intentionally minimal: vivid colours do the communicating, not chrome.

## Run it

No build step, no dependencies. Just open the site:

```bash
# Option A — open directly
open index.html        # macOS  (use `xdg-open` on Linux)

# Option B — serve locally
python3 -m http.server 8000
# then visit http://localhost:8000
```

## How it works

- `index.html` — markup and the day-editor dialog.
- `styles.css` — the colour system and responsive week grid.
- `app.js` — state, rendering, and persistence (vanilla JS, no framework).

Plans are stored in your browser's `localStorage`, so your work is there when you
come back. Use **Export** to save a portable copy or move a plan between devices.

## Tips

- Click any day to edit it. `Esc` closes the editor; `⌘/Ctrl + Enter` saves.
- Set the **Plan start** to the Monday of your first week — every week snaps to Monday.
- A day with no mileage, type, or notes stays empty (rest day by default).
