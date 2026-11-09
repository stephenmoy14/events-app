"""Cross-source duplicate matching. Phase 5.

Plan: candidates share a local date and a normalized venue; compare normalize.match_key(title)
(exact first, fuzzy later). Keep the earliest-seen row as canonical and set duplicate_of on the rest.
"""


def mark_duplicates(conn) -> int:
    raise NotImplementedError("phase 5")
