"""Base class every source fetcher extends."""
from __future__ import annotations

import email.utils
import time
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import httpx

from ..config import env
from ..models import Event

RETRY_STATUSES = {429, 500, 502, 503, 504}


class Fetcher(ABC):
    name: str = ""             # registry key, e.g. "tribe_events"
    min_delay_s: float = 2.0   # politeness default; override per source with delay_seconds in config

    def __init__(self, city: dict, source_cfg: dict, source_name: str | None = None):
        self.city = city
        self.cfg = source_cfg or {}
        # The row in the sources table. Generic fetchers (tribe_events, bibliocommons) serve
        # several sources, so this comes from the config key rather than the class.
        self.source_name = source_name or self.name
        self.tz = ZoneInfo(city["timezone"])
        self.min_delay_s = float(self.cfg.get("delay_seconds", self.min_delay_s))
        self._last_request = 0.0
        self.client = httpx.Client(
            timeout=30,
            follow_redirects=True,
            headers={"User-Agent": env("USER_AGENT", "ChicagoEventsBot/0.1")},
        )

    def window(self) -> tuple[datetime, datetime]:
        """Today (local midnight) through window_days out, as aware datetimes."""
        start = datetime.now(self.tz).replace(hour=0, minute=0, second=0, microsecond=0)
        return start, start + timedelta(days=self.city.get("window_days", 35))

    def in_window(self, ev: Event) -> bool:
        start, end = self.window()
        return (ev.end_at or ev.start_at) >= start and ev.start_at < end

    max_attempts: int = 3
    _sleep = staticmethod(time.sleep)     # swapped out in tests

    def get(self, url: str, **kwargs) -> httpx.Response:
        """GET with the per-site delay, plus up to 3 tries for timeouts, connection errors,
        429 and 5xx responses (honoring Retry-After). Other 4xx errors raise immediately."""
        for attempt in range(1, self.max_attempts + 1):
            wait = self.min_delay_s - (time.monotonic() - self._last_request)
            if wait > 0:
                self._sleep(wait)
            try:
                resp = self.client.get(url, **kwargs)
            except httpx.TransportError:
                self._last_request = time.monotonic()
                if attempt == self.max_attempts:
                    raise
                self._sleep(self._backoff(attempt))
                continue
            self._last_request = time.monotonic()
            if resp.status_code in RETRY_STATUSES and attempt < self.max_attempts:
                self._sleep(self._retry_after(resp) or self._backoff(attempt))
                continue
            resp.raise_for_status()
            return resp
        raise RuntimeError("unreachable")

    @staticmethod
    def _backoff(attempt: int) -> float:
        return 5.0 * 3 ** (attempt - 1)      # 5s, 15s

    @staticmethod
    def _retry_after(resp: httpx.Response) -> float | None:
        value = resp.headers.get("Retry-After")
        if not value:
            return None
        if value.isdigit():
            return min(float(value), 120.0)
        try:
            when = email.utils.parsedate_to_datetime(value)
            return max(0.0, min((when - datetime.now(when.tzinfo)).total_seconds(), 120.0))
        except (TypeError, ValueError):
            return None

    @abstractmethod
    def fetch(self) -> list[Event]:
        """Return every event in the window, already shaped as Event."""
