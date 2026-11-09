"""Scheduling and health rules shared by the runner and its tests."""
from __future__ import annotations

from datetime import datetime, timedelta

# Slightly under a day / week so a run that starts a few minutes later than last time
# isn't skipped.
CADENCE = {
    "daily": timedelta(hours=20),
    "weekly": timedelta(days=6, hours=12),
}
ALERT_AFTER_FAILURES = 3


def is_due(cadence: str, last_success: datetime | None, now: datetime) -> bool:
    """Should a source with this cadence run now, given its last successful run?"""
    if last_success is None:
        return True
    return now - last_success >= CADENCE.get(cadence, CADENCE["daily"])


def summary_table(rows: list[dict]) -> str:
    """Markdown table for the GitHub Actions run summary."""
    lines = [
        "| Source | Result | Found | New | Updated | Failures in a row | Note |",
        "| --- | --- | ---: | ---: | ---: | ---: | --- |",
    ]
    icons = {"ok": "✅ ok", "error": "❌ error", "skipped": "⏭️ skipped", "dry-run": "🧪 dry run"}
    for r in rows:
        note = (r.get("note") or "").replace("|", "\\|").replace("\n", " ")[:200]
        lines.append(
            f"| {r['source']} | {icons.get(r['status'], r['status'])} | {r.get('found', '')} | "
            f"{r.get('new', '')} | {r.get('updated', '')} | {r.get('failures', '')} | {note} |"
        )
    return "\n".join(lines)
