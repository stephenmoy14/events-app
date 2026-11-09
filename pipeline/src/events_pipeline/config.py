"""Loads env vars and the per-city YAML config."""
from __future__ import annotations

import os
from pathlib import Path

import yaml
from dotenv import load_dotenv


def _find_root() -> Path:
    """The repo root: EVENTS_APP_ROOT if set, else the nearest folder (from the working
    directory, then from this file) that contains config/cities. Works for editable installs,
    regular installs and Docker alike."""
    if os.environ.get("EVENTS_APP_ROOT"):
        return Path(os.environ["EVENTS_APP_ROOT"]).resolve()
    for start in (Path.cwd(), Path(__file__).resolve().parent):
        for folder in (start, *start.parents):
            if (folder / "config" / "cities").is_dir():
                return folder
    raise RuntimeError("couldn't find config/cities; run from inside the repo or set EVENTS_APP_ROOT")


REPO_ROOT = _find_root()
load_dotenv(REPO_ROOT / ".env")


def env(name: str, default: str | None = None) -> str | None:
    return os.environ.get(name, default)


def load_city(city: str | None = None) -> dict:
    city = city or env("CITY", "chicago")
    path = REPO_ROOT / "config" / "cities" / f"{city}.yaml"
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f)
