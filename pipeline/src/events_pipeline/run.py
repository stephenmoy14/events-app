"""CLI: python -m events_pipeline.run [--source NAME] [--dry-run] [--force] [--city chicago]

Runs every enabled source that is due (daily sources about once a day, weekly ones about once
a week, based on each source's last successful run). --force or --source runs regardless.

Exit code: 0 normally, even if a source failed once or twice (it's retried next run).
2 when any source has failed ALERT_AFTER_FAILURES runs in a row, so the scheduled GitHub
Actions run fails and GitHub emails you.
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone

from .config import load_city
from .enrich import Neighborhoods, enrich, in_area
from .health import ALERT_AFTER_FAILURES, is_due, summary_table
from .normalize import to_utc
from .sources import REGISTRY


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default=None)
    ap.add_argument("--source", help="run one source (ignores cadence)")
    ap.add_argument("--dry-run", action="store_true", help="fetch and print, don't write to DB")
    ap.add_argument("--force", action="store_true", help="run every enabled source, ignoring cadence")
    args = ap.parse_args(argv)

    city = load_city(args.city)
    names = [args.source] if args.source else [
        n for n, c in city["sources"].items() if c.get("enabled")
    ]
    check_cadence = not (args.source or args.force or args.dry_run)

    conn = None
    if not args.dry_run:
        from . import db
        conn = db.connect()
        db.close_stale_runs(conn)
        conn.commit()

    now = datetime.now(timezone.utc)
    areas = Neighborhoods.from_config(city)
    report: list[dict] = []
    alerting: list[str] = []

    for name in names:
        cfg = city["sources"].get(name, {})
        kind = cfg.get("fetcher", name)
        if kind not in REGISTRY:
            report.append({"source": name, "status": "skipped", "note": f"no fetcher '{kind}'"})
            continue

        src_id = run_id = None
        if conn:
            src_id = db.source_id(conn, name)
            if check_cadence:
                last_ok = db.last_success(conn, src_id)
                cadence = cfg.get("cadence", "daily")
                if not is_due(cadence, last_ok, now):
                    report.append({"source": name, "status": "skipped",
                                   "note": f"{cadence}; last success {last_ok:%Y-%m-%d %H:%M} UTC"})
                    continue
            run_id = db.start_run(conn, src_id)
            conn.commit()

        print(f"[{name}] running…", flush=True)
        try:
            fetcher = REGISTRY[kind](city, cfg, source_name=name)
            events = enrich([to_utc(e) for e in fetcher.fetch() if in_area(e, city)], areas)
            if conn:
                new, updated = db.upsert_events(conn, src_id, events)
                db.finish_run(conn, run_id, status="ok", found=len(events), new=new, updated=updated)
                db.set_failures(conn, src_id, reset=True)
                conn.commit()
                report.append({"source": name, "status": "ok", "found": len(events),
                               "new": new, "updated": updated, "failures": 0})
                print(f"[{name}] found={len(events)} new={new} updated={updated}")
            else:
                report.append({"source": name, "status": "dry-run", "found": len(events)})
                print(f"[{name}] found={len(events)} (dry run)")
                for e in sorted(events, key=lambda e: e.start_at)[:15]:
                    print(f"  {e.start_at:%a %b %d %H:%M}Z  {e.title}  @ {e.venue_name}"
                          f"  [{e.category_group}{', ' + e.neighborhood if e.neighborhood else ''}]")
        except Exception as exc:  # one broken source shouldn't stop the others
            msg = f"{type(exc).__name__}: {exc}"
            print(f"[{name}] ERROR: {msg}", file=sys.stderr)
            failures = None
            if conn:
                conn.rollback()
                db.finish_run(conn, run_id, status="error", error=msg[:2000])
                failures = db.set_failures(conn, src_id, reset=False)
                conn.commit()
                if failures >= ALERT_AFTER_FAILURES:
                    alerting.append(name)
            report.append({"source": name, "status": "error", "failures": failures, "note": msg})

    if conn:
        # Re-match duplicates across all sources after every run (takes a few seconds).
        try:
            from . import dedupe
            hidden = dedupe.run(conn, city)
            conn.commit()
            report.append({"source": "(dedupe)", "status": "ok", "note": f"{hidden} duplicates hidden"})
        except Exception as exc:
            conn.rollback()
            print(f"[dedupe] ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)
            report.append({"source": "(dedupe)", "status": "error", "note": f"{type(exc).__name__}: {exc}"})

    table = summary_table(report)
    print("\n" + table)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write("## Scrape run\n\n" + table + "\n")
            if alerting:
                f.write(f"\n**Failing {ALERT_AFTER_FAILURES}+ runs in a row:** {', '.join(alerting)}\n")

    if alerting:
        print(f"\nALERT: {', '.join(alerting)} failed {ALERT_AFTER_FAILURES}+ runs in a row",
              file=sys.stderr)
        return 2
    if args.dry_run or args.source:
        # Interactive use: surface any error in the exit code.
        return 1 if any(r["status"] == "error" for r in report) else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
