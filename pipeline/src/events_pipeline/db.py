"""Postgres access: upserts and scrape_runs logging."""
from __future__ import annotations

import psycopg

from .config import env
from .models import Event
from .normalize import content_hash

UPSERT_SQL = """
insert into events (source_id, source_event_id, title, start_at, end_at, venue_name, address,
    neighborhood, lat, lon, price_min, price_max, is_free, category, url, image_url, content_hash)
values (%(source_id)s, %(source_event_id)s, %(title)s, %(start_at)s, %(end_at)s, %(venue_name)s,
    %(address)s, %(neighborhood)s, %(lat)s, %(lon)s, %(price_min)s, %(price_max)s, %(is_free)s,
    %(category)s, %(url)s, %(image_url)s, %(content_hash)s)
on conflict (source_id, source_event_id) do update set
    title = excluded.title, start_at = excluded.start_at, end_at = excluded.end_at,
    venue_name = excluded.venue_name, address = excluded.address,
    neighborhood = excluded.neighborhood, lat = excluded.lat, lon = excluded.lon,
    price_min = excluded.price_min, price_max = excluded.price_max, is_free = excluded.is_free,
    category = excluded.category, url = excluded.url, image_url = excluded.image_url,
    content_hash = excluded.content_hash, last_seen_at = now(), missed_runs = 0
"""


def connect() -> psycopg.Connection:
    url = env("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set (see .env.example)")
    return psycopg.connect(url)


def source_id(conn: psycopg.Connection, name: str) -> int:
    row = conn.execute("select id from sources where name = %s", (name,)).fetchone()
    if row is None:
        raise RuntimeError(f"source '{name}' not in sources table")
    return row[0]


def start_run(conn: psycopg.Connection, src_id: int) -> int:
    return conn.execute(
        "insert into scrape_runs (source_id) values (%s) returning id", (src_id,)
    ).fetchone()[0]


def finish_run(conn, run_id: int, *, status: str, found=0, new=0, updated=0, error=None) -> None:
    conn.execute(
        """update scrape_runs set finished_at = now(), status = %s, events_found = %s,
           events_new = %s, events_updated = %s, error_message = %s where id = %s""",
        (status, found, new, updated, error, run_id),
    )


def last_success(conn: psycopg.Connection, src_id: int):
    row = conn.execute(
        "select max(finished_at) from scrape_runs where source_id = %s and status = 'ok'", (src_id,)
    ).fetchone()
    return row[0] if row else None


def set_failures(conn: psycopg.Connection, src_id: int, *, reset: bool) -> int:
    """Reset or bump sources.consecutive_failures; returns the new count."""
    sql = ("update sources set consecutive_failures = 0 where id = %s returning consecutive_failures"
           if reset else
           "update sources set consecutive_failures = consecutive_failures + 1 where id = %s "
           "returning consecutive_failures")
    return conn.execute(sql, (src_id,)).fetchone()[0]


def close_stale_runs(conn: psycopg.Connection, hours: int = 3) -> None:
    """Runs left 'running' by a killed process (timeout, cancelled job) get marked as errors."""
    conn.execute(
        """update scrape_runs set status = 'error', finished_at = now(),
               error_message = 'interrupted (process stopped before finishing)'
           where status = 'running' and started_at < now() - make_interval(hours => %s)""",
        (hours,),
    )


def upsert_events(conn: psycopg.Connection, src_id: int, events: list[Event]) -> tuple[int, int]:
    """Returns (new, updated). Rows whose content_hash is unchanged only get last_seen_at bumped."""
    new = updated = 0
    for ev in events:
        h = content_hash(ev)
        existing = conn.execute(
            "select content_hash from events where source_id = %s and source_event_id = %s",
            (src_id, ev.source_event_id),
        ).fetchone()
        if existing and existing[0] == h:
            conn.execute(
                """update events set last_seen_at = now(), missed_runs = 0
                   where source_id = %s and source_event_id = %s""",
                (src_id, ev.source_event_id),
            )
            continue
        params = ev.model_dump(mode="json") | {"source_id": src_id, "content_hash": h}
        conn.execute(UPSERT_SQL, params)
        if existing:
            updated += 1
        else:
            new += 1
    # Anything from this source not seen this run gets a strike (2 strikes = hidden).
    # An empty result is more likely a broken parser than mass cancellation, so skip strikes.
    if not events:
        return new, updated
    seen = [ev.source_event_id for ev in events]
    conn.execute(
        """update events set missed_runs = missed_runs + 1
           where source_id = %s and start_at > now() and not (source_event_id = any(%s))""",
        (src_id, seen),
    )
    return new, updated
