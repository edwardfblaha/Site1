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
- **Accounts** — sign in (email/password or Google) for a private plan that
  autosaves to the cloud and syncs across devices.
- **Export / import** plans as JSON.

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

- `index.html` — markup, the login screen, and the day-editor dialog.
- `styles.css` — the colour system and responsive week grid.
- `app.js` — state, rendering, auth, and persistence (vanilla JS, no framework).
- `config.js` — your Supabase URL and anon key (see below).

## Accounts & sync (Supabase)

Each user signs in and gets their own private plan that persists across devices
and browsers. The whole plan (every day, AM/PM sessions, strides, hill sprints,
race days, units, start date, week count) is stored as one JSON record per user,
protected by Row Level Security so no one can read another user's data.

### 1. Create a Supabase project

Sign up at <https://supabase.com> and create a project.

### 2. Paste your credentials

Open **`config.js`** and replace the two placeholders:

```js
window.SUPABASE_URL = "SUPABASE_URL";            // ← paste your Project URL here
window.SUPABASE_ANON_KEY = "SUPABASE_ANON_KEY";  // ← paste your anon public key here
```

Find both under **Project Settings → API** in the Supabase dashboard
("Project URL" and the "anon" / "public" key).

### 3. Create the table (run this SQL)

In the Supabase dashboard open **SQL Editor → New query**, paste the following,
and click **Run**:

```sql
-- One private plan per user, stored as JSON, with updated_at.
create table if not exists public.plans (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Lock the table down so each user only ever sees their own row.
alter table public.plans enable row level security;

create policy "plans_select_own"
  on public.plans for select
  using (auth.uid() = user_id);

create policy "plans_insert_own"
  on public.plans for insert
  with check (auth.uid() = user_id);

create policy "plans_update_own"
  on public.plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Grant the signed-in role base access to the table. RLS (above) still
-- restricts WHICH rows each user can touch; without this grant every query
-- is rejected with "42501: permission denied for table plans".
grant select, insert, update, delete on table public.plans to authenticated;
```

> Already created the table earlier and seeing `42501: permission denied`? Just run
> the `grant …` line on its own — the rest will report "already exists", which is safe.

> **Note on the schema:** the plan is saved as a single `jsonb` column rather than
> separate `week_index / day_index / miles / type / notes / pace` columns. That is
> deliberate — the per-column layout can't hold the app's AM/PM sessions, strides,
> hill sprints, race days, or plan settings, and you asked for the site to be
> preserved exactly. The JSON record keeps every feature intact.

### 4. Enable Google sign-in (for the "Continue with Google" button)

In the dashboard go to **Authentication → Providers → Google**, enable it, and
add your Google OAuth client ID/secret (from the Google Cloud console). Add your
site's URL to **Authentication → URL Configuration → Redirect URLs**. Email/password
login works without this step.

Plans autosave to Supabase as you edit. Any plan already saved in your browser is
imported automatically the first time you sign in. Use **Export** for a portable
JSON copy.

## Tips

- Click any day to edit it. `Esc` closes the editor; `⌘/Ctrl + Enter` saves.
- Set the **Plan start** to the Monday of your first week — every week snaps to Monday.
- A day with no mileage, type, or notes stays empty (rest day by default).
