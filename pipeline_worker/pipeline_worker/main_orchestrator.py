"""
Main orchestrator for the faculty profile extraction pipeline.

Wires together URL discovery, concurrent HTML fetching, profile extraction,
and Supabase persistence (including temporal office-hours tracking) into a
single async DAG.

Usage::

    # Run as a module (recommended — keeps package imports working)
    python -m pipeline_worker.main_orchestrator

    # Or invoke the file directly from the pipeline_worker/ directory
    python main_orchestrator.py
"""

from __future__ import annotations

import asyncio
import logging
import logging.handlers
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional
from urllib.parse import parse_qs, urlparse

import aiohttp
from dotenv import load_dotenv
from supabase import Client, create_client

from pipeline_worker.building_aliases import resolve_canonical_building_name
from pipeline_worker.crawlers.discovery_playwright import discover_faculty_urls
from pipeline_worker.parsers.html_scraper import ProfileExtractor
from pipeline_worker.parsers.models import FacultyProfile, OfficeHourSlot

# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------

# Resolve .env from the repository root (three levels up from inside the
# package; gracefully ignored when the vars are already in the environment).
_ENV_PATH: Path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=False)

_LOG_DIR: Path = Path(__file__).resolve().parent.parent / "logs"
os.makedirs(_LOG_DIR, exist_ok=True)

_LOG_FORMATTER = logging.Formatter(
    fmt="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)

_console_handler = logging.StreamHandler()
_console_handler.setFormatter(_LOG_FORMATTER)

_file_handler = logging.handlers.RotatingFileHandler(
    filename=_LOG_DIR / "pipeline_run.log",
    maxBytes=10_485_760,  # 10 MB
    backupCount=5,
    encoding="utf-8",
)
_file_handler.setFormatter(_LOG_FORMATTER)

logging.root.setLevel(logging.INFO)
logging.root.addHandler(_console_handler)
logging.root.addHandler(_file_handler)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Seeded list of departmental faculty roster pages to crawl.
# Each URL points to a department's "Faculty" listing on the Dickinson website.
DEPARTMENT_SEED_URLS: list[str] = [
    "https://www.dickinson.edu/homepage/235/music_department_faculty",
    "https://www.dickinson.edu/homepage/209/art_and_art_history_department_faculty",
    "https://www.dickinson.edu/homepage/244/spanish_and_portuguese_department_faculty",
    "https://www.dickinson.edu/homepage/240/psychology_department_faculty",
    "https://www.dickinson.edu/homepage/231/mathematics_department_faculty",
    "https://www.dickinson.edu/homepage/211/biology_department_faculty",
    "https://www.dickinson.edu/homepage/225/history_department_faculty",
    "https://www.dickinson.edu/homepage/238/physics_and_astronomy_department_faculty",
    "https://www.dickinson.edu/homepage/228/italian_department_faculty",
    "https://www.dickinson.edu/homepage/213/classical_studies_department_faculty",
    "https://www.dickinson.edu/homepage/226/international_business_and_management_department_faculty",
    "https://www.dickinson.edu/homepage/222/french_department_faculty",
    "https://www.dickinson.edu/homepage/237/philosophy_department_faculty",
    "https://www.dickinson.edu/homepage/212/chemistry_department_faculty",
    "https://www.dickinson.edu/homepage/217/economics_department_faculty",
    "https://www.dickinson.edu/homepage/533/religion_department_faculty",
    "https://www.dickinson.edu/homepage/239/political_science_department_faculty",
    "https://www.dickinson.edu/homepage/215/geosciences_department_faculty",
    "https://www.dickinson.edu/homepage/207/anthropology_department_faculty",
    "https://www.dickinson.edu/homepage/236/neuroscience_department_faculty",
    "https://www.dickinson.edu/homepage/243/sociology_department_faculty",
    "https://www.dickinson.edu/homepage/216/east_asian_studies_department_faculty",
    "https://www.dickinson.edu/homepage/219/english_department_faculty",
    "https://www.dickinson.edu/homepage/529/computer_science_department_faculty",
    "https://www.dickinson.edu/homepage/241/russian_department_faculty",
    "https://www.dickinson.edu/homepage/203/german_department_faculty",
    "https://www.dickinson.edu/homepage/1481/data_analytics_department_faculty",
    "https://www.dickinson.edu/homepage/227/international_studies_department_faculty",
    "https://www.dickinson.edu/homepage/208/archaeology_department_faculty",
    "https://www.dickinson.edu/homepage/233/middle_east_studies_department_faculty",
    "https://www.dickinson.edu/homepage/534/women_s_and_gender_studies_department_faculty",
    "https://www.dickinson.edu/homepage/210/biochemistry_and_molecular_biology_department_faculty",
    "https://www.dickinson.edu/homepage/220/environmental_studies_and_environmental_science_department_faculty",
    "https://www.dickinson.edu/homepage/221/film_studies_department_faculty",
    "https://www.dickinson.edu/homepage/531/law_and_policy_department_faculty",
    "https://www.dickinson.edu/homepage/206/american_studies_department_faculty",
    "https://www.dickinson.edu/homepage/538/humanities_department_faculty",
    "https://www.dickinson.edu/info/20136/military_science/4625/military_science_department_faculty_and_staff",
    "https://www.dickinson.edu/homepage/204/africana_studies_department_faculty",
    "https://www.dickinson.edu/homepage/229/judaic_studies_department_faculty",
    "https://www.dickinson.edu/homepage/224/health_studies_department_faculty",
    "https://www.dickinson.edu/homepage/242/security_studies_department_faculty",
    "https://www.dickinson.edu/homepage/532/portuguese_and_brazilian_studies_department_faculty",
    "https://www.dickinson.edu/homepage/230/latin_american_latino_and_caribbean_studies_department_faculty",
    "https://www.dickinson.edu/homepage/232/medieval_and_early_modern_studies_department_faculty",
    "https://www.dickinson.edu/homepage/234/military_science_department_faculty",
    "https://www.dickinson.edu/homepage/218/educational_studies_faculty",
    "https://www.dickinson.edu/info/20103/computer_science/4051/computer_science_department_hours",
]

# URL template for individual faculty profile pages (fac= query parameter).
_PROFILE_URL_TEMPLATE: str = (
    "https://www.dickinson.edu/site/custom_scripts/"
    "dc_faculty_profile_index.php?fac={fac_id}"
)

# Target throughput cap — ethical scraping ceiling per our crawl RFC.
_FETCH_RPS: float = 2.0

# Number of profile pages fetched concurrently per asyncio.gather batch.
# Kept in the 10–20 range so individual batch durations stay predictable.
_BATCH_SIZE: int = 10

# Per-request wall-clock timeout (seconds) for aiohttp fetches.
_HTTP_TIMEOUT_S: int = 30

# Identifies this traffic as a student research tool so Dickinson IT
# administrators can recognise and whitelist it if needed.
_REQUEST_HEADERS: dict[str, str] = {
    "User-Agent": (
        "DickinsonStudySpacesBot/1.0 "
        "(Dickinson College student project — faculty office-hours aggregator; "
        "contact: it-help@dickinson.edu)"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------


def _build_supabase_client() -> Client:
    """
    Construct an authenticated Supabase client from environment variables.

    Raises :exc:`EnvironmentError` when either required variable is absent,
    failing fast before any network work is attempted.
    """
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise EnvironmentError(
            "Both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set "
            "in the environment (or in .env at the repository root)."
        )
    return create_client(url, key)


def _current_term() -> str:
    """
    Derive a human-readable academic-term label from today's UTC date.

    Mapping:
    - Jan–May  → "Spring YYYY"
    - Jun–Aug  → "Summer YYYY"
    - Sep–Dec  → "Fall YYYY"
    """
    now = datetime.now(tz=timezone.utc)
    if now.month <= 5:
        return f"Spring {now.year}"
    if now.month <= 8:
        return f"Summer {now.year}"
    return f"Fall {now.year}"


def _slot_fingerprint(slot: OfficeHourSlot) -> tuple:
    """
    Return a deterministic, hashable tuple representing *slot*.

    Used to compare scraped office hours against persisted rows without
    relying on database-generated IDs.
    """
    return (
        slot.day_of_week,
        str(slot.start_time) if slot.start_time else None,
        str(slot.end_time) if slot.end_time else None,
        slot.is_by_appointment,
        (slot.location or "").strip().lower(),
    )


def _db_row_fingerprint(row: dict) -> tuple:
    """
    Produce the same fingerprint shape as :func:`_slot_fingerprint` from a
    raw Supabase row dict, normalising time strings for comparison.
    """
    return (
        row["day_of_week"],
        row.get("start_time"),
        row.get("end_time"),
        row.get("is_by_appointment", False),
        (row.get("location") or "").strip().lower(),
    )


def _office_hour_slot_key(row: dict) -> tuple:
    """Idempotency key: day + start + end (active-row duplicate detection)."""
    start = row.get("start_time")
    end = row.get("end_time")
    return (
        row["day_of_week"],
        str(start) if start is not None else None,
        str(end) if end is not None else None,
    )


def _load_active_slot_keys(supabase: Client, professor_id: str) -> set[tuple]:
    """Return slot keys for all active (valid_until IS NULL) office-hour rows."""
    res = (
        supabase.table("professor_office_hours")
        .select("day_of_week, start_time, end_time")
        .eq("professor_id", professor_id)
        .is_("valid_until", "null")
        .execute()
    )
    return {_office_hour_slot_key(r) for r in (res.data or [])}


# ---------------------------------------------------------------------------
# Utility: fac-ID extraction
# ---------------------------------------------------------------------------


def _extract_fac_id(url: str) -> Optional[str]:
    """
    Return the ``fac`` query-parameter value from a faculty profile URL, or
    ``None`` when the parameter is absent or the URL is malformed.

    Example::

        _extract_fac_id(
            "https://www.dickinson.edu/site/custom_scripts/"
            "dc_faculty_profile_index.php?fac=12345"
        )
        # → "12345"
    """
    values = parse_qs(urlparse(url).query).get("fac", [])
    return values[0] if values else None


# ---------------------------------------------------------------------------
# Async HTTP fetching
# ---------------------------------------------------------------------------


async def fetch_profile_html(
    session: aiohttp.ClientSession,
    fac_id: str,
) -> tuple[str, Optional[str]]:
    """
    Fetch the HTML body of the faculty profile page identified by *fac_id*.

    The URL is constructed from :data:`_PROFILE_URL_TEMPLATE`.  The session
    is expected to carry :data:`_REQUEST_HEADERS` (including the descriptive
    ``User-Agent``) so each request is identifiable by Dickinson IT staff.

    :param session: A shared :class:`aiohttp.ClientSession` (headers already
                    set at session construction time).
    :param fac_id:  The ``fac=`` query-parameter value for the target profile.
    :returns: ``(fac_id, html)`` on success; ``(fac_id, None)`` on any error
              so that individual failures never abort the broader pipeline.
    """
    url = _PROFILE_URL_TEMPLATE.format(fac_id=fac_id)
    try:
        timeout = aiohttp.ClientTimeout(total=_HTTP_TIMEOUT_S)
        async with session.get(url, timeout=timeout) as resp:
            if resp.status != 200:
                logger.warning(
                    "HTTP %d fetching fac_id=%r — skipping.", resp.status, fac_id
                )
                return fac_id, None
            html = await resp.text()
            logger.debug("Fetched %d bytes for fac_id=%r.", len(html), fac_id)
            return fac_id, html
    except asyncio.TimeoutError:
        logger.warning("Timeout fetching fac_id=%r — skipping.", fac_id)
        return fac_id, None
    except Exception as exc:
        logger.warning("Fetch error for fac_id=%r: %s", fac_id, exc)
        return fac_id, None


# ---------------------------------------------------------------------------
# Supabase persistence (synchronous supabase-py v2 API)
# ---------------------------------------------------------------------------


def load_building_cache(supabase: Client) -> Dict[str, str]:
    """Load ``buildings.name`` -> ``id`` for strict canonical FK resolution."""
    res = supabase.table("buildings").select("id, name").execute()
    cache: Dict[str, str] = {}
    for row in res.data or []:
        name = row.get("name")
        row_id = row.get("id")
        if name and row_id:
            cache[name] = row_id
    logger.info("Loaded %d building(s) into resolution cache.", len(cache))
    return cache


def _upsert_professor_id(
    supabase: Client,
    prof_row: dict,
    on_conflict: str,
    profile_name: str,
) -> Optional[str]:
    """Upsert a professor row and return its UUID, or ``None`` on failure."""
    res = (
        supabase.table("professors")
        .upsert(prof_row, on_conflict=on_conflict)
        .select("id")
        .execute()
    )
    if getattr(res, "error", None):
        logger.critical(
            "Professor upsert failed for %r on %s: %s",
            profile_name,
            on_conflict,
            res.error,
        )
        return None
    if not res.data:
        logger.critical(
            "Professor upsert returned no row for %r on %s — office hours skipped.",
            profile_name,
            on_conflict,
        )
        return None
    return res.data[0]["id"]


def upsert_to_supabase(
    supabase: Client,
    profile: FacultyProfile,
    dept_hint: str = "",
    building_cache: Optional[Dict[str, str]] = None,
) -> None:
    """
    Persist *profile* to Supabase using a temporal data model.

    Algorithm
    ---------
    1. Upsert ``departments`` to resolve a UUID for ``profile.department``
       (falls back to *dept_hint* from the discovery phase when HTML extraction
       yielded an empty string).
    2. Upsert ``professors`` on ``email``, ``profile_url``, or ``fac_id``
       (never name alone), updating ``bio``, ``title``, and ``publications``.
    3. Retrieve the professor's UUID.
    4. Load currently-active ``professor_office_hours`` rows
       (``valid_until IS NULL``).
    5. Compare them against the freshly scraped slots via deterministic
       fingerprints.
    6. If the sets differ: close the old rows (``valid_until = NOW()``) and
       insert the new ones, stamped with the current academic term.

    :param supabase:  Authenticated Supabase client.
    :param profile:   Extracted faculty profile.
    :param dept_hint: Department name from the discovery phase; used only when
                      ``profile.department`` is empty.
    """
    # --- 1. Resolve department -----------------------------------------------
    # Prefer the HTML-extracted department; fall back to the discovery hint.
    effective_department = profile.department or dept_hint

    department_id: Optional[str] = None
    if effective_department:
        dept_res = (
            supabase.table("departments")
            .upsert({"name": effective_department}, on_conflict="name")
            .select("id")
            .execute()
        )
        if dept_res.data:
            department_id = dept_res.data[0]["id"]
        else:
            logger.warning(
                "Department upsert returned no data for %r.", effective_department
            )

    # --- 1b. Resolve building (canonical alias map + relational fallback) ------
    # Primary path: map scraped text via BUILDING_ALIASES -> exact buildings.name.
    # Fallback: department.primary_building_id when scrape is missing or unmapped.
    building_id: Optional[str] = None
    cache = building_cache or {}
    if profile.primary_building:
        canonical_name = resolve_canonical_building_name(profile.primary_building)
        if canonical_name:
            building_id = cache.get(canonical_name)
            if building_id:
                logger.info(
                    "Mapped %s to building UUID %s (%s).",
                    profile.name,
                    building_id,
                    canonical_name,
                )
            else:
                logger.warning(
                    "Canonical building %r not in cache (seed drift?) for %r — department fallback.",
                    canonical_name,
                    profile.name,
                )
        else:
            logger.warning(
                "No canonical mapping for %r — will attempt department fallback.",
                profile.primary_building,
            )

    # Relational fallback: profile.primary_building was None or unmapped.
    if building_id is None and department_id:
        try:
            dept_bldg_res = (
                supabase.table("departments")
                .select("primary_building_id")
                .eq("id", department_id)
                .single()
                .execute()
            )
            fallback_building_id: Optional[str] = (
                dept_bldg_res.data.get("primary_building_id")
                if dept_bldg_res.data
                else None
            )
            if fallback_building_id:
                building_id = fallback_building_id
                logger.info(
                    "Fallback: Mapped %s to department's primary building UUID %s.",
                    profile.name,
                    building_id,
                )
            else:
                logger.warning(
                    "CRITICAL: %s has NO building mapped.",
                    profile.name,
                )
        except Exception as exc:
            logger.warning(
                "Department building fallback query failed for %r: %s",
                profile.name,
                exc,
            )
            logger.warning("CRITICAL: %s has NO building mapped.", profile.name)
    elif building_id is None:
        # department_id also absent — nothing to fall back to.
        logger.warning("CRITICAL: %s has NO building mapped.", profile.name)

    # --- 2. Build professor row -----------------------------------------------
    prof_row: dict = {
        "name": profile.name,
        "title": profile.title or None,
        "bio": profile.bio,
        "publications": profile.publications,
    }
    if department_id:
        prof_row["department_id"] = department_id
    if building_id:
        prof_row["building_id"] = building_id
    if profile.email:
        prof_row["email"] = profile.email

    prof_row["profile_url"] = profile.source_url
    fac_id = _extract_fac_id(profile.source_url)
    if fac_id:
        prof_row["fac_id"] = fac_id

    # --- 3. Upsert / locate professor (strict identity; never match on name) ---
    professor_id: Optional[str] = None

    if profile.email:
        professor_id = _upsert_professor_id(
            supabase, prof_row, "email", profile.name
        )
    elif profile.source_url:
        professor_id = _upsert_professor_id(
            supabase, prof_row, "profile_url", profile.name
        )
    elif fac_id:
        professor_id = _upsert_professor_id(
            supabase, prof_row, "fac_id", profile.name
        )

    if not professor_id:
        if not profile.email and not profile.source_url and not fac_id:
            logger.critical(
                "No identity key (email, profile_url, fac_id) for %r — office hours skipped.",
                profile.name,
            )
        return

    logger.info("Upserted professor %r (id=%s).", profile.name, professor_id)

    # --- 4. Skip if no office hours were scraped ------------------------------
    if not profile.office_hours:
        logger.debug("No office hours scraped for %r.", profile.name)
        return

    # --- 5. Load currently-active rows ----------------------------------------
    active_res = (
        supabase.table("professor_office_hours")
        .select("id, day_of_week, start_time, end_time, is_by_appointment, location")
        .eq("professor_id", professor_id)
        .is_("valid_until", "null")
        .execute()
    )
    existing_rows: list[dict] = active_res.data or []

    # --- 6. Fingerprint comparison --------------------------------------------
    existing_fps = {_db_row_fingerprint(r) for r in existing_rows}
    scraped_fps = {_slot_fingerprint(s) for s in profile.office_hours}

    if existing_fps == scraped_fps:
        logger.debug("Office hours unchanged for %r — no write needed.", profile.name)
        return

    # --- 7. Expire stale rows -------------------------------------------------
    # This flow is not fully transactional through supabase-py. To avoid leaving
    # orphan temporal state when insert fails after expiration, we apply a
    # compensating rollback that restores old rows to active state.
    old_ids: list[str] = []
    if existing_rows:
        now_iso = datetime.now(tz=timezone.utc).isoformat()
        old_ids = [r["id"] for r in existing_rows]
        expire_res = (
            supabase.table("professor_office_hours")
            .update({"valid_until": now_iso})
            .in_("id", old_ids)
            .execute()
        )
        if getattr(expire_res, "error", None):
            raise RuntimeError(
                f"Failed to expire stale office-hour rows for {profile.name}: "
                f"{expire_res.error}"
            )
        logger.info(
            "Expired %d stale office-hour row(s) for %r.",
            len(old_ids),
            profile.name,
        )

    # --- 8. Insert fresh rows -------------------------------------------------
    term = _current_term()
    new_rows = [
        {
            "professor_id": professor_id,
            "term_identifier": term,
            "day_of_week": slot.day_of_week,
            "start_time": str(slot.start_time) if slot.start_time else None,
            "end_time": str(slot.end_time) if slot.end_time else None,
            "is_by_appointment": slot.is_by_appointment,
            "location": slot.location,
        }
        for slot in profile.office_hours
    ]
    active_keys = _load_active_slot_keys(supabase, professor_id)
    rows_to_insert = [
        r for r in new_rows if _office_hour_slot_key(r) not in active_keys
    ]
    if not rows_to_insert:
        logger.warning(
            "All scraped office-hour slots already active for %r — skipping insert.",
            profile.name,
        )
        return

    try:
        insert_res = (
            supabase.table("professor_office_hours").insert(rows_to_insert).execute()
        )
        if getattr(insert_res, "error", None):
            raise RuntimeError(
                f"Failed inserting fresh office-hour rows for {profile.name}: "
                f"{insert_res.error}"
            )
    except Exception:
        if old_ids:
            try:
                restore_res = (
                    supabase.table("professor_office_hours")
                    .update({"valid_until": None})
                    .in_("id", old_ids)
                    .execute()
                )
                if getattr(restore_res, "error", None):
                    logger.error(
                        "Rollback failed restoring expired office-hour rows for %r: %s",
                        profile.name,
                        restore_res.error,
                    )
                else:
                    logger.warning(
                        "Rollback restored %d previously expired office-hour row(s) for %r.",
                        len(old_ids),
                        profile.name,
                    )
            except Exception as rollback_exc:
                logger.error(
                    "Rollback exception restoring office-hour rows for %r: %s",
                    profile.name,
                    rollback_exc,
                    exc_info=True,
                )
        raise

    logger.info(
        "Inserted %d new office-hour row(s) for %r (term=%s).",
        len(rows_to_insert),
        profile.name,
        term,
    )


# ---------------------------------------------------------------------------
# Core pipeline
# ---------------------------------------------------------------------------


async def run_pipeline() -> None:
    """
    Execute the full end-to-end extraction pipeline.

    Stage 1 — Discovery
        :func:`discover_faculty_urls` drives a headless Chromium browser
        against the Dickinson directory, handling infinite scroll and
        pagination, and returns a deduplicated list of profile URLs from
        which ``fac=`` IDs are extracted.

    Stage 2 — Batched async HTTP fetch
        ``fac`` IDs are processed in batches of :data:`_BATCH_SIZE` using
        :func:`fetch_profile_html` dispatched via :func:`asyncio.gather`.
        After each batch an :func:`asyncio.sleep` pause enforces the
        :data:`_FETCH_RPS` rate ceiling to comply with ethical-crawl policy.

    Stage 3 — Extraction
        Each HTML payload is passed to
        :class:`~pipeline_worker.parsers.html_scraper.ProfileExtractor`
        to produce a validated :class:`~pipeline_worker.parsers.models.FacultyProfile`.

    Stage 4 — Persistence
        :func:`upsert_to_supabase` writes each profile and synchronises its
        office hours using a bitemporal insert/expire strategy.
    """
    supabase = _build_supabase_client()
    building_cache = load_building_cache(supabase)
    extractor = ProfileExtractor()
    term = _current_term()
    logger.info("Pipeline starting — term=%s", term)

    # ------------------------------------------------------------------
    # Stage 1 — URL discovery
    # ------------------------------------------------------------------
    logger.info(
        "Discovering faculty URLs from %d departmental seed page(s) …",
        len(DEPARTMENT_SEED_URLS),
    )
    url_to_dept: dict[str, str] = await discover_faculty_urls(DEPARTMENT_SEED_URLS)
    logger.info("Discovered %d unique faculty profile URL(s).", len(url_to_dept))

    if not url_to_dept:
        logger.warning("No URLs discovered — pipeline exiting early.")
        return

    # Build a mapping of fac_id → (profile_url, dept_hint) for each discovered URL.
    # Profiles without a ``fac=`` parameter are silently skipped (e.g. staff pages).
    fac_id_to_dept: dict[str, str] = {}
    fac_id_to_url: dict[str, str] = {}
    for url, dept in url_to_dept.items():
        fac_id = _extract_fac_id(url)
        if fac_id and fac_id not in fac_id_to_dept:
            fac_id_to_dept[fac_id] = dept
            fac_id_to_url[fac_id] = url

    fac_ids: list[str] = list(fac_id_to_dept.keys())
    if not fac_ids:
        logger.warning("No fac IDs resolved from discovered URLs — pipeline exiting early.")
        return
    logger.info("Resolved %d fac ID(s) for HTTP fetch.", len(fac_ids))

    # ------------------------------------------------------------------
    # Stage 2 — Batched async HTTP fetch (rate-limited)
    # ------------------------------------------------------------------
    total_batches = (len(fac_ids) + _BATCH_SIZE - 1) // _BATCH_SIZE
    logger.info(
        "Fetching %d profile page(s) in %d batch(es) of up to %d "
        "(rate cap: %.0f RPS) …",
        len(fac_ids),
        total_batches,
        _BATCH_SIZE,
        _FETCH_RPS,
    )

    results: list[tuple[str, Optional[str]]] = []

    # Headers are set once on the session so every request carries the
    # descriptive User-Agent without repeating it per call.
    async with aiohttp.ClientSession(headers=_REQUEST_HEADERS) as session:
        for batch_num, batch_start in enumerate(
            range(0, len(fac_ids), _BATCH_SIZE), start=1
        ):
            batch = fac_ids[batch_start : batch_start + _BATCH_SIZE]
            batch_results: list[tuple[str, Optional[str]]] = await asyncio.gather(
                *[fetch_profile_html(session, fid) for fid in batch]
            )
            results.extend(batch_results)
            logger.debug(
                "Batch %d/%d complete (%d fac ID(s)).", batch_num, total_batches, len(batch)
            )

            # Rate-limiting pause — sleep proportional to batch size so the
            # average throughput stays at or below _FETCH_RPS.
            if batch_start + _BATCH_SIZE < len(fac_ids):
                await asyncio.sleep(len(batch) / _FETCH_RPS)

    fetched = sum(1 for _, html in results if html is not None)
    logger.info("Fetch complete: %d/%d pages retrieved.", fetched, len(fac_ids))

    # ------------------------------------------------------------------
    # Stage 3 & 4 — Extract and persist
    # ------------------------------------------------------------------
    success = failure = skipped = 0
    for fac_id, html in results:
        if html is None:
            skipped += 1
            continue

        profile_url = _PROFILE_URL_TEMPLATE.format(fac_id=fac_id)
        dept_hint = fac_id_to_dept.get(fac_id, "")
        try:
            profile: FacultyProfile = extractor.extract(html, profile_url)

            if not profile.name:
                logger.warning("Empty name extracted for fac_id=%r — skipping.", fac_id)
                skipped += 1
                continue

            if not profile.department and dept_hint:
                logger.info(
                    "Using discovery-phase dept hint %r for %r (HTML extraction yielded nothing).",
                    dept_hint,
                    profile.name,
                )

            upsert_to_supabase(
                supabase,
                profile,
                dept_hint=dept_hint,
                building_cache=building_cache,
            )
            success += 1

        except Exception as exc:
            logger.error(
                "Unhandled error processing fac_id=%r: %s", fac_id, exc, exc_info=True
            )
            failure += 1

    logger.info(
        "Pipeline complete — success=%d  skipped=%d  failure=%d.",
        success,
        skipped,
        failure,
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    asyncio.run(run_pipeline())
