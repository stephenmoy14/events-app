from datetime import datetime, timedelta, timezone

import httpx

from events_pipeline.health import is_due, summary_table
from events_pipeline.sources.base import Fetcher

NOW = datetime(2026, 11, 9, 10, 17, tzinfo=timezone.utc)


def test_never_run_is_due():
    assert is_due("weekly", None, NOW)


def test_daily_runs_again_next_morning_even_if_a_bit_early():
    assert is_due("daily", NOW - timedelta(hours=23, minutes=50), NOW)
    assert not is_due("daily", NOW - timedelta(hours=2), NOW)


def test_weekly_waits_about_a_week():
    assert not is_due("weekly", NOW - timedelta(days=3), NOW)
    assert is_due("weekly", NOW - timedelta(days=6, hours=23), NOW)


def test_summary_table_escapes_pipes():
    table = summary_table([{"source": "x", "status": "error", "note": "a|b"}])
    assert "a\\|b" in table and "❌ error" in table


class FakeClient:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = 0

    def get(self, url, **kwargs):
        self.calls += 1
        r = self.responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


class Dummy(Fetcher):
    name = "dummy"
    min_delay_s = 0

    def fetch(self):
        return []


def make(responses):
    f = Dummy({"timezone": "America/Chicago"}, {})
    f.client = FakeClient(responses)
    f.sleeps = []
    f._sleep = f.sleeps.append
    return f


def resp(status, headers=None):
    return httpx.Response(status, headers=headers, request=httpx.Request("GET", "https://example.com"))


def test_retries_5xx_then_succeeds():
    f = make([resp(503), resp(200)])
    assert f.get("https://example.com").status_code == 200
    assert f.client.calls == 2 and f.sleeps == [5.0]


def test_honors_retry_after():
    f = make([resp(429, {"Retry-After": "7"}), resp(200)])
    f.get("https://example.com")
    assert f.sleeps == [7.0]


def test_retries_connection_errors():
    f = make([httpx.ConnectError("boom"), resp(200)])
    assert f.get("https://example.com").status_code == 200


def test_404_fails_immediately():
    f = make([resp(404), resp(200)])
    try:
        f.get("https://example.com")
        raise AssertionError("expected HTTPStatusError")
    except httpx.HTTPStatusError:
        pass
    assert f.client.calls == 1


def test_gives_up_after_three_tries():
    f = make([resp(500), resp(500), resp(500)])
    try:
        f.get("https://example.com")
        raise AssertionError("expected HTTPStatusError")
    except httpx.HTTPStatusError:
        pass
    assert f.client.calls == 3
