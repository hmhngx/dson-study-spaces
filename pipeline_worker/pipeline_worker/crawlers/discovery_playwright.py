"""
Playwright-based faculty URL discovery crawler for Dickinson College department pages.

Visits each URL in a seeded list of departmental faculty roster pages, extracts
all anchor tags whose ``href`` contains ``fac=``, and returns a deduplicated
mapping of faculty profile URL → department hint (derived from the seed URL slug).

Typical usage::

    import asyncio
    from pipeline_worker.crawlers.discovery_playwright import discover_faculty_urls

    url_to_dept = asyncio.run(discover_faculty_urls(DEPARTMENT_SEED_URLS))
"""

from __future__ import annotations

import asyncio
import logging
import re
from urllib.parse import urlparse

from playwright.async_api import (
    Browser,
    BrowserContext,
    Error as PlaywrightError,
    Page,
    TimeoutError as PlaywrightTimeoutError,
    async_playwright,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Maximum time (ms) to wait for each departmental page to load.
_PAGE_LOAD_TIMEOUT_MS: int = 60_000

# Time (ms) to wait for the DOM to settle after navigation.
_SETTLE_TIMEOUT_MS: int = 5_000

# Total retry attempts for transient browser/network errors across the whole run.
_MAX_RETRIES: int = 3

# Exponential-backoff base delay (seconds) between retries.
_RETRY_BASE_DELAY_S: float = 2.0

# Number of departmental pages crawled concurrently.
_DISCOVERY_CONCURRENCY: int = 5

# Small delay between gather batches to keep request pressure modest.
_BATCH_DELAY_S: float = 0.5


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _dept_name_from_seed_url(seed_url: str) -> str:
    """
    Derive a human-readable department name from a departmental seed URL slug.

    Examples::

        _dept_name_from_seed_url(".../biology_department_faculty")
        # → "Biology"

        _dept_name_from_seed_url(".../art_and_art_history_department_faculty")
        # → "Art and Art History"

        _dept_name_from_seed_url(".../women_s_and_gender_studies_department_faculty")
        # → "Women's and Gender Studies"
    """
    slug = urlparse(seed_url).path.rstrip("/").split("/")[-1]
    # Strip common page-type suffixes that aren't part of the dept name.
    slug = re.sub(
        r"_department(?:_faculty(?:_and_staff)?|_hours)?$|_faculty$",
        "",
        slug,
    )
    # Restore possessives: "women_s" → "women's"
    slug = re.sub(r"(\w)_s(?=_|$)", r"\1's", slug)
    # Lowercase joiners that should not be title-cased.
    words = slug.replace("_", " ").split()
    _LOWERCASE_WORDS = {"and", "of", "in", "the", "a", "an"}
    title_words = [
        w if (i > 0 and w in _LOWERCASE_WORDS) else w.capitalize()
        for i, w in enumerate(words)
    ]
    return " ".join(title_words)


async def _wait_for_dom_settle(page: Page, timeout_ms: int = _SETTLE_TIMEOUT_MS) -> None:
    """
    Wait for the network to reach *networkidle* or for *timeout_ms* to elapse,
    whichever comes first.  Timeouts are silently absorbed.
    """
    try:
        await page.wait_for_load_state("networkidle", timeout=timeout_ms)
    except PlaywrightTimeoutError:
        logger.debug("Network-idle timeout after %d ms — proceeding with current DOM.", timeout_ms)


def _chunked(values: list[str], size: int) -> list[list[str]]:
    """Split *values* into fixed-size chunks, preserving order."""
    if size <= 0:
        raise ValueError("chunk size must be > 0")
    return [values[i : i + size] for i in range(0, len(values), size)]


async def _crawl_seed_url(
    context: BrowserContext,
    url: str,
    idx: int,
    total: int,
) -> tuple[str, str, list[str]]:
    """
    Crawl a single departmental seed URL and return extracted profile hrefs.

    Returns ``(url, dept_hint, hrefs)``. Errors are absorbed per-URL and return
    an empty href list so one failure does not abort the whole batch.
    """
    dept_hint = _dept_name_from_seed_url(url)
    page: Page | None = None
    try:
        page = await context.new_page()
        page.set_default_timeout(_PAGE_LOAD_TIMEOUT_MS)
        await page.goto(
            url,
            wait_until="domcontentloaded",
            timeout=_PAGE_LOAD_TIMEOUT_MS,
        )
        await _wait_for_dom_settle(page)
        hrefs: list[str] = await page.evaluate(
            """() => Array.from(document.querySelectorAll('a[href*="fac="]')).map(a => a.href)"""
        )
        return url, dept_hint, hrefs
    except PlaywrightTimeoutError as exc:
        logger.warning(
            "Dept page %d/%d timed out — skipping. URL: %s  Error: %s",
            idx, total, url, exc,
        )
        return url, dept_hint, []
    except PlaywrightError as exc:
        logger.warning(
            "Dept page %d/%d navigation error — skipping. URL: %s  Error: %s",
            idx, total, url, exc,
        )
        return url, dept_hint, []
    finally:
        if page is not None:
            await page.close()


async def _run_with_browser(seed_urls: list[str]) -> dict[str, str]:
    """
    Spin up a single headless Chromium instance, visit every URL in *seed_urls*,
    collect all ``fac=`` profile links, and return a mapping of profile URL →
    department hint derived from the seed URL slug.

    When a profile URL is found on multiple department pages the first department
    encountered is kept (deterministic because *seed_urls* is ordered).

    Browser and context are always closed in a ``finally`` block so that no
    orphan Chromium processes are left behind on exceptions.
    """
    url_to_dept: dict[str, str] = {}
    browser: Browser | None = None
    context: BrowserContext | None = None

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ],
        )
        try:
            context = await browser.new_context(
                viewport={"width": 1280, "height": 900},
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/122.0.0.0 Safari/537.36"
                ),
                java_script_enabled=True,
            )
            total = len(seed_urls)
            chunks = _chunked(seed_urls, _DISCOVERY_CONCURRENCY)
            global_idx = 0
            for chunk_idx, chunk in enumerate(chunks, start=1):
                chunk_tasks = []
                chunk_positions = []
                for url in chunk:
                    global_idx += 1
                    chunk_positions.append(global_idx)
                    chunk_tasks.append(_crawl_seed_url(context, url, global_idx, total))

                chunk_results = await asyncio.gather(*chunk_tasks, return_exceptions=True)

                for pos, result in zip(chunk_positions, chunk_results):
                    if isinstance(result, Exception):
                        logger.warning(
                            "Unexpected discovery task failure at dept page %d/%d: %s",
                            pos,
                            total,
                            result,
                        )
                        continue

                    url, dept_hint, hrefs = result
                    before = len(url_to_dept)
                    for href in hrefs:
                        if href not in url_to_dept:
                            url_to_dept[href] = dept_hint
                    new_count = len(url_to_dept) - before
                    logger.info(
                        "Dept page %d/%d: +%d new profile URL(s), %d cumulative total. [%s]",
                        pos,
                        total,
                        new_count,
                        len(url_to_dept),
                        url,
                    )

                if chunk_idx < len(chunks):
                    await asyncio.sleep(_BATCH_DELAY_S)

        finally:
            if context is not None:
                await context.close()
            await browser.close()

    return url_to_dept


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def discover_faculty_urls(seed_urls: list[str]) -> dict[str, str]:
    """
    Discover all faculty profile URLs by visiting each URL in *seed_urls*.

    Launches a single headless Chromium browser session and crawls departmental
    roster pages in bounded parallel batches. Per-page navigation errors
    (404s, timeouts) are logged as warnings and skipped so a single bad URL
    cannot abort the run. A small polite delay is observed between batches.

    Transient errors that crash the whole browser session are retried up to
    ``_MAX_RETRIES`` times with exponential back-off before the exception is
    re-raised to the caller.

    :param seed_urls: Ordered list of departmental faculty roster page URLs.
    :returns: Mapping of absolute faculty profile URL → department name hint
              derived from the seed page slug.  When a professor appears on
              multiple department pages the first department encountered is kept.
    :raises RuntimeError: When the browser session fails after all retries.
    :raises PlaywrightError: When the browser encounters an unrecoverable error.

    Example::

        from pipeline_worker.crawlers.discovery_playwright import discover_faculty_urls

        url_to_dept = await discover_faculty_urls(DEPARTMENT_SEED_URLS)
        print(f"Found {len(url_to_dept)} faculty profiles.")
    """
    last_exc: Exception | None = None

    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            logger.info(
                "discover_faculty_urls: attempt %d/%d — crawling %d seed URL(s).",
                attempt,
                _MAX_RETRIES,
                len(seed_urls),
            )
            url_to_dept = await _run_with_browser(seed_urls)
            logger.info(
                "discover_faculty_urls: completed — %d unique profile URL(s) found.",
                len(url_to_dept),
            )
            return url_to_dept

        except PlaywrightTimeoutError as exc:
            last_exc = exc
            delay = _RETRY_BASE_DELAY_S * (2 ** (attempt - 1))
            logger.warning(
                "Browser session timeout on attempt %d/%d: %s. Retrying in %.1f s.",
                attempt, _MAX_RETRIES, exc, delay,
            )
            await asyncio.sleep(delay)

        except PlaywrightError as exc:
            last_exc = exc
            delay = _RETRY_BASE_DELAY_S * (2 ** (attempt - 1))
            logger.warning(
                "Playwright error on attempt %d/%d: %s. Retrying in %.1f s.",
                attempt, _MAX_RETRIES, exc, delay,
            )
            await asyncio.sleep(delay)

        except RuntimeError as exc:
            last_exc = exc
            delay = _RETRY_BASE_DELAY_S * (2 ** (attempt - 1))
            logger.warning(
                "Runtime error on attempt %d/%d: %s. Retrying in %.1f s.",
                attempt, _MAX_RETRIES, exc, delay,
            )
            await asyncio.sleep(delay)

    raise RuntimeError(
        f"discover_faculty_urls failed after {_MAX_RETRIES} attempt(s) "
        f"across {len(seed_urls)} seed URL(s)."
    ) from last_exc
