"""Registry of fetchers.

A source in config/cities/<city>.yaml picks its fetcher with `fetcher:` (defaults to the
source's own name). Generic fetchers like tribe_events and bibliocommons can back many sources.
"""
from .base import Fetcher
from .bibliocommons import BiblioCommonsFetcher
from .eventbrite import EventbriteFetcher
from .ticketmaster import TicketmasterFetcher
from .tribe_events import TribeEventsFetcher

REGISTRY: dict[str, type[Fetcher]] = {
    f.name: f
    for f in (TicketmasterFetcher, EventbriteFetcher, BiblioCommonsFetcher, TribeEventsFetcher)
}
