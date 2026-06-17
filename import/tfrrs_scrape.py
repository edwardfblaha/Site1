#!/usr/bin/env python3
"""Scrape NCAA DI cross country meet results from TFRRS into a local SQLite DB.

Stores, per finisher: runner name, school, finish position, time, and meet name.

DESIGN (per the request): start with ONE meet page and prove it works before
scaling up. So by default this scrapes a single meet URL and prints a summary.
Scaling to a whole season is a thin loop on top (see `crawl_season` + the
`--season` flag) once you've confirmed the single-meet path looks right.

USAGE
    # 1) prove the parser + DB pipeline works with no network:
    python tfrrs_scrape.py --selftest

    # 2) scrape one real meet (run this on a machine that can reach tfrrs.org):
    python tfrrs_scrape.py --url https://www.tfrrs.org/results/xc/<id>/<slug>

    # 3) only after that looks right, scale up from an index/conference page:
    python tfrrs_scrape.py --season https://www.tfrrs.org/...index-page...

REQUIREMENTS
    pip install requests beautifulsoup4 lxml

GOOD CITIZEN
    TFRRS is a real service. Requests are rate-limited (see DELAY) and sent with
    an identifying User-Agent. Review tfrrs.org's terms and robots.txt before any
    large pull, and keep the crawl slow. This environment cannot reach tfrrs.org
    (network egress allowlist); run the live modes on your own machine.
"""
from __future__ import annotations

import argparse
import re
import sqlite3
import sys
import time
from dataclasses import dataclass
from typing import Iterable

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:  # keep --selftest usable even before deps are installed
    requests = None
    BeautifulSoup = None

# ----------------------------- config -----------------------------
DB_PATH = "tfrrs.db"
USER_AGENT = "XC-Results-Scraper/1.0 (personal research; contact: you@example.com)"
DELAY_SECONDS = 3.0          # be polite: pause between requests
REQUEST_TIMEOUT = 30
SEASON = "2026"


# ----------------------------- data model -----------------------------
@dataclass
class Result:
    event: str          # e.g. "Men 8k", "Women 6k"
    gender: str         # "M" / "F" / ""
    place: int | None
    runner: str
    school: str
    time_text: str      # as printed, e.g. "23:41.2"
    time_seconds: float | None


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS meets (
            id        INTEGER PRIMARY KEY,
            tfrrs_id  TEXT UNIQUE,
            name      TEXT NOT NULL,
            url       TEXT,
            season    TEXT
        );
        CREATE TABLE IF NOT EXISTS results (
            id            INTEGER PRIMARY KEY,
            meet_id       INTEGER NOT NULL REFERENCES meets(id),
            event         TEXT,
            gender        TEXT,
            place         INTEGER,
            runner        TEXT NOT NULL,
            school        TEXT,
            time_text     TEXT,
            time_seconds  REAL,
            UNIQUE(meet_id, event, runner, time_text)
        );
        """
    )
    conn.commit()


def upsert_meet(conn: sqlite3.Connection, tfrrs_id: str, name: str, url: str) -> int:
    conn.execute(
        "INSERT OR IGNORE INTO meets (tfrrs_id, name, url, season) VALUES (?, ?, ?, ?)",
        (tfrrs_id, name, url, SEASON),
    )
    row = conn.execute("SELECT id FROM meets WHERE tfrrs_id = ?", (tfrrs_id,)).fetchone()
    conn.commit()
    return row[0]


def save_results(conn: sqlite3.Connection, meet_id: int, results: Iterable[Result]) -> int:
    rows = [
        (meet_id, r.event, r.gender, r.place, r.runner, r.school, r.time_text, r.time_seconds)
        for r in results
    ]
    conn.executemany(
        """INSERT OR IGNORE INTO results
           (meet_id, event, gender, place, runner, school, time_text, time_seconds)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        rows,
    )
    conn.commit()
    return len(rows)


# ----------------------------- parsing -----------------------------
def time_to_seconds(text: str) -> float | None:
    """'23:41.2' -> 1421.2 ; '1:02:03' -> 3723.0 ; returns None if unparseable."""
    text = (text or "").strip()
    m = re.match(r"^(?:(\d+):)?(\d{1,2}):(\d{2}(?:\.\d+)?)$", text)  # h:mm:ss or mm:ss
    if m:
        h = int(m.group(1)) if m.group(1) else 0
        return h * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    m = re.match(r"^(\d{1,2}):(\d{2}(?:\.\d+)?)$", text)            # mm:ss
    if m:
        return int(m.group(1)) * 60 + float(m.group(2))
    return None


def event_label(heading: str) -> tuple[str, str]:
    """Best-effort (label, gender) from a table heading like 'Men 8,000 Meters'."""
    h = (heading or "").strip()
    gender = "M" if re.search(r"\bmen\b", h, re.I) and not re.search(r"\bwomen\b", h, re.I) else \
             "F" if re.search(r"\bwomen\b", h, re.I) else ""
    dist = ""
    md = re.search(r"(\d{1,2})[\s,]?000|\b(\d)k\b|\b(\d{4,5})\b", h, re.I)
    if md:
        if md.group(1):
            dist = f"{md.group(1)}k"
        elif md.group(2):
            dist = f"{md.group(2)}k"
        elif md.group(3):
            dist = f"{int(md.group(3)) // 1000}k"
    label = " ".join(p for p in [{"M": "Men", "F": "Women"}.get(gender, ""), dist] if p) or h or "Race"
    return label, gender


def meet_id_from_url(url: str) -> str:
    m = re.search(r"/results/(?:xc/)?(\d+)", url)
    return m.group(1) if m else url


def parse_meet(html: str, url: str = "") -> tuple[str, list[Result]]:
    """Return (meet_name, results). Tuned to TFRRS results-page structure:
    a results <table> per event, each preceded by a heading naming the event,
    rows containing a place, an athlete link, a team link, and a finish time."""
    soup = BeautifulSoup(html, "lxml")

    name_el = soup.find(["h3", "h1"]) or soup.find("title")
    meet_name = re.sub(r"\s+", " ", name_el.get_text(strip=True)) if name_el else "Unknown Meet"

    results: list[Result] = []
    for table in soup.find_all("table"):
        # Heading: nearest preceding heading/caption text describing the event.
        heading = ""
        prev = table.find_previous(["h1", "h2", "h3", "h4", "caption", "div", "span"])
        if prev:
            heading = re.sub(r"\s+", " ", prev.get_text(" ", strip=True))[:120]
        label, gender = event_label(heading)

        for tr in table.find_all("tr"):
            tds = tr.find_all("td")
            if len(tds) < 3:
                continue  # header / spacer row

            athlete = tr.find("a", href=re.compile(r"/athletes/"))
            school_link = tr.find("a", href=re.compile(r"/teams/"))
            runner = (athlete.get_text(strip=True) if athlete else tds[1].get_text(strip=True))
            runner = re.sub(r"\s+", " ", runner)
            school = (school_link.get_text(strip=True) if school_link else "")

            # place = first cell that's a bare integer
            place = None
            first = tds[0].get_text(strip=True)
            if first.isdigit():
                place = int(first)

            # time = last cell that parses as a time
            time_text, time_seconds = "", None
            for cell in reversed(tds):
                secs = time_to_seconds(cell.get_text(strip=True))
                if secs is not None:
                    time_text = cell.get_text(strip=True)
                    time_seconds = secs
                    break

            if runner and time_seconds is not None:
                results.append(Result(label, gender, place, runner, school, time_text, time_seconds))

    return meet_name, results


# ----------------------------- fetching -----------------------------
def make_session():
    if requests is None:
        raise RuntimeError("`requests` not installed. Run: pip install requests beautifulsoup4 lxml")
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT, "Accept": "text/html"})
    return s


def fetch(session, url: str, retries: int = 3) -> str:
    for attempt in range(1, retries + 1):
        try:
            resp = session.get(url, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            return resp.text
        except Exception as e:  # noqa: BLE001 - report and back off
            if attempt == retries:
                raise
            wait = DELAY_SECONDS * attempt
            print(f"  ! fetch failed ({e}); retry {attempt}/{retries} in {wait:.0f}s", file=sys.stderr)
            time.sleep(wait)
    return ""


def scrape_meet(session, conn: sqlite3.Connection, url: str) -> int:
    print(f"↓ {url}")
    html = fetch(session, url)
    meet_name, results = parse_meet(html, url)
    if not results:
        print("  ✗ no results parsed — the page layout may differ; inspect the HTML.", file=sys.stderr)
        return 0
    meet_id = upsert_meet(conn, meet_id_from_url(url), meet_name, url)
    n = save_results(conn, meet_id, results)
    print(f"  ✓ {meet_name}: stored {n} results across "
          f"{len({r.event for r in results})} event(s)")
    return n


def discover_meet_links(html: str, base: str) -> list[str]:
    """Find meet result-page links under an index/conference/team page (for scaling)."""
    soup = BeautifulSoup(html, "lxml")
    links = set()
    for a in soup.find_all("a", href=re.compile(r"/results/(xc/)?\d")):
        href = a["href"]
        if href.startswith("/"):
            href = "https://www.tfrrs.org" + href
        links.add(href.split("#")[0])
    return sorted(links)


def crawl_season(session, conn: sqlite3.Connection, index_url: str) -> None:
    """Scale-up path: discover meets from an index page, then scrape each politely."""
    print(f"· discovering meets under {index_url}")
    meets = discover_meet_links(fetch(session, index_url), index_url)
    print(f"· found {len(meets)} meet links")
    for i, url in enumerate(meets, 1):
        print(f"[{i}/{len(meets)}]", end=" ")
        try:
            scrape_meet(session, conn, url)
        except Exception as e:  # noqa: BLE001 - keep going on a bad meet
            print(f"  ! skipped {url}: {e}", file=sys.stderr)
        time.sleep(DELAY_SECONDS)


# ----------------------------- self test -----------------------------
SAMPLE_HTML = """
<html><head><title>Sample Invitational</title></head><body>
<h3>Sample Invitational</h3>
<h4>Men 8,000 Meters</h4>
<table>
  <tr><th>PL</th><th>NAME</th><th>TEAM</th><th>TIME</th></tr>
  <tr><td>1</td><td><a href="/athletes/1/">Doe, John</a></td>
      <td><a href="/teams/9/">State U</a></td><td>23:41.2</td></tr>
  <tr><td>2</td><td><a href="/athletes/2/">Roe, Rich</a></td>
      <td><a href="/teams/8/">Tech</a></td><td>23:55.0</td></tr>
</table>
<h4>Women 6,000 Meters</h4>
<table>
  <tr><th>PL</th><th>NAME</th><th>TEAM</th><th>TIME</th></tr>
  <tr><td>1</td><td><a href="/athletes/3/">Poe, Pat</a></td>
      <td><a href="/teams/9/">State U</a></td><td>20:02.7</td></tr>
</table>
</body></html>
"""


def selftest() -> int:
    if BeautifulSoup is None:
        print("✗ selftest needs beautifulsoup4 + lxml: pip install beautifulsoup4 lxml", file=sys.stderr)
        return 1
    name, results = parse_meet(SAMPLE_HTML, "https://www.tfrrs.org/results/xc/12345/Sample")
    assert name == "Sample Invitational", name
    assert len(results) == 3, results
    assert results[0].runner == "Doe, John" and results[0].school == "State U"
    assert abs(results[0].time_seconds - 1421.2) < 1e-6
    assert results[2].gender == "F" and results[2].event == "Women 6k"

    conn = sqlite3.connect(":memory:")
    init_db(conn)
    mid = upsert_meet(conn, "12345", name, "https://example/12345")
    save_results(conn, mid, results)
    save_results(conn, mid, results)  # idempotent: UNIQUE prevents duplicates
    (count,) = conn.execute("SELECT COUNT(*) FROM results").fetchone()
    assert count == 3, count
    print("✓ selftest passed: parsed 3 results, stored 3 (dedupe OK)")
    for row in conn.execute("SELECT place, runner, school, time_text, event FROM results ORDER BY event, place"):
        print("   ", row)
    return 0


# ----------------------------- cli -----------------------------
def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Scrape NCAA DI XC results from TFRRS into SQLite.")
    ap.add_argument("--url", help="a single TFRRS meet results URL (start here)")
    ap.add_argument("--season", help="an index/conference page to discover & scrape many meets")
    ap.add_argument("--db", default=DB_PATH, help=f"SQLite path (default {DB_PATH})")
    ap.add_argument("--selftest", action="store_true", help="run offline against bundled sample HTML")
    args = ap.parse_args(argv)

    if args.selftest:
        return selftest()

    if not args.url and not args.season:
        ap.error("give --url <meet> (recommended first) or --season <index>, or --selftest")

    conn = sqlite3.connect(args.db)
    init_db(conn)
    session = make_session()

    if args.url:
        scrape_meet(session, conn, args.url)
    if args.season:
        crawl_season(session, conn, args.season)

    total = conn.execute("SELECT COUNT(*) FROM results").fetchone()[0]
    meets = conn.execute("SELECT COUNT(*) FROM meets").fetchone()[0]
    print(f"\nDB {args.db}: {meets} meet(s), {total} result(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
