"""
Canonical building names and scraped-string aliases for strict FK resolution.

Names must match ``back-end/api/data/data.json`` / Supabase ``buildings.name`` exactly.
Keep in sync with seed data; do not use fuzzy or ilike matching here.
"""

from __future__ import annotations

from typing import Optional

# Exact Supabase / data.json building names (19 entries).
CANONICAL_BUILDING_NAMES: frozenset[str] = frozenset(
    {
        "Waidner-Spahr Library",
        "Althouse Hall",
        "Rector Science Complex",
        "Kline Fitness Center",
        "Bosler Hall",
        "Holland Union Building (HUB)",
        "Denny Hall",
        "East College",
        "Denim Coffee at the Quarry",
        "Tome Hall",
        "Anita Tuvin Schlechter Auditorium (ATS)",
        "Kaufman Hall / Stafford Greenhouse",
        "Weiss Arts Center",
        "Stern Center for Global Education",
        "Montgomery Hall",
        "Landis House",
        "Keck Archaeology Laboratory",
        "ROTC Building",
        "Educational Studies Department Building",
    }
)

# Scraped / shorthand strings -> canonical ``buildings.name``.
BUILDING_ALIASES: dict[str, str] = {
    # Tome
    "Tome": "Tome Hall",
    "Tome Scientific Building": "Tome Hall",
    "Tome Hall": "Tome Hall",
    # Rector
    "Rector": "Rector Science Complex",
    "Rector Science Complex": "Rector Science Complex",
    # Weiss / arts
    "Weiss Arts Center": "Weiss Arts Center",
    "Emil R. Weiss Center for the Arts": "Weiss Arts Center",
    "Weiss Center for the Arts": "Weiss Arts Center",
    # HUB
    "Holland Union Building": "Holland Union Building (HUB)",
    "Holland Union Building (HUB)": "Holland Union Building (HUB)",
    "HUB": "Holland Union Building (HUB)",
    # Kaufman
    "Kaufman Hall": "Kaufman Hall / Stafford Greenhouse",
    "Stafford Greenhouse": "Kaufman Hall / Stafford Greenhouse",
    "Kaufman Hall / Stafford Greenhouse": "Kaufman Hall / Stafford Greenhouse",
    # Library
    "Waidner-Spahr Library": "Waidner-Spahr Library",
    "Waidner Library": "Waidner-Spahr Library",
    "Spahr Library": "Waidner-Spahr Library",
    # Halls — common scrapes from _RE_BUILDING
    "Althouse Hall": "Althouse Hall",
    "Althouse": "Althouse Hall",
    "Bosler Hall": "Bosler Hall",
    "Bosler": "Bosler Hall",
    "Denny Hall": "Denny Hall",
    "Denny": "Denny Hall",
    "East College": "East College",
    "Montgomery Hall": "Montgomery Hall",
    "Montgomery": "Montgomery Hall",
    "Landis House": "Landis House",
    "Landis": "Landis House",
    # Stern
    "Stern Center for Global Education": "Stern Center for Global Education",
    "Stern Center": "Stern Center for Global Education",
    # ATS
    "Anita Tuvin Schlechter Auditorium (ATS)": "Anita Tuvin Schlechter Auditorium (ATS)",
    "Anita Tuvin Schlechter Auditorium": "Anita Tuvin Schlechter Auditorium (ATS)",
    "ATS": "Anita Tuvin Schlechter Auditorium (ATS)",
    # Keck / ROTC / Ed studies
    "Keck Archaeology Laboratory": "Keck Archaeology Laboratory",
    "Keck": "Keck Archaeology Laboratory",
    "ROTC Building": "ROTC Building",
    "ROTC": "ROTC Building",
    "Educational Studies Department Building": "Educational Studies Department Building",
    "Educational Studies Building": "Educational Studies Department Building",
    # Fitness / coffee
    "Kline Fitness Center": "Kline Fitness Center",
    "Kline": "Kline Fitness Center",
    "Denim Coffee at the Quarry": "Denim Coffee at the Quarry",
    "Denim": "Denim Coffee at the Quarry",
}


def _normalize_key(value: str) -> str:
    return " ".join(value.split()).lower()


_ALIAS_LOOKUP: dict[str, str] = {}
for _alias, _canonical in BUILDING_ALIASES.items():
    _ALIAS_LOOKUP[_normalize_key(_alias)] = _canonical
for _name in CANONICAL_BUILDING_NAMES:
    _ALIAS_LOOKUP[_normalize_key(_name)] = _name


def resolve_canonical_building_name(raw: Optional[str]) -> Optional[str]:
    """
    Map a scraped building string to an exact canonical ``buildings.name``.

    Returns ``None`` when *raw* is empty or has no entry in the alias map
    (caller should use department ``primary_building_id`` fallback).
    """
    if raw is None:
        return None
    stripped = raw.strip()
    if not stripped:
        return None
    return _ALIAS_LOOKUP.get(_normalize_key(stripped))
