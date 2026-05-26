"""
HTML extraction layer for faculty profile pages.

Uses BeautifulSoup4 with RFC-specified CSS selectors and regex as the primary
strategy for each field, falling back to broader heuristics when the canonical
selector yields nothing.  Every extraction step is individually guarded so that
a missing phone number (or any other optional field) never aborts the pipeline.
"""

from __future__ import annotations

import logging
import re
from typing import Optional

from bs4 import BeautifulSoup, Tag

from pipeline_worker.parsers.models import FacultyProfile, OfficeHourSlot
from pipeline_worker.parsers.office_hours_fsm import OfficeHourParser

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# RFC-specified compiled patterns (primary strategies)
# ---------------------------------------------------------------------------

# Name: strip "Profile of " prefix from <title>
_RE_PROFILE_TITLE = re.compile(r"Profile of (.*)", re.IGNORECASE)

# Email: must be a valid @dickinson.edu address
_RE_EMAIL_DICKINSON = re.compile(r"^[a-zA-Z0-9._%+-]+@dickinson\.edu$")

# Email: well-known institutional/role addresses that are NOT personal faculty emails.
# These appear in page headers/footers on every Dickinson profile page and must be
# skipped so the scraper does not assign the same address to every professor.
_RE_INSTITUTIONAL_EMAIL = re.compile(
    r"^(webmaster|it-?help|admissions|info|contact|help|noreply|no-reply|library|registrar|bursar)@",
    re.IGNORECASE,
)

# Phone: NXX-NXX-XXXX (e.g. 717-245-1474)
_RE_PHONE = re.compile(r"\b\d{3}-\d{3}-\d{4}\b")

# Sabbatical: case-insensitive
_RE_SABBATICAL = re.compile(r"(?i)on sabbatical")

# Building: matches named campus buildings (e.g. "Tome Scientific Building",
# "Althouse Hall", "Weiss Arts Center").  The suffix anchor ensures we only
# capture proper facility names and not free-form location strings.
_RE_BUILDING = re.compile(
    r"\b([A-Z][A-Za-z'\-\s]+?(?:"
    r"Building|Hall|Center|House|Laboratory|Lab|Library|Chapel|"
    r"Gymnasium|Stadium|Annex|Cottage|Lodge|Arena|Pavilion|Tower|Commons"
    r"))\b"
)

# Publications (basic): quoted text in sentences near author/published
_RE_QUOTED_TITLE = re.compile(r'"([^"]+)"')
_RE_PUB_CONTEXT = re.compile(r"\b(?:author(?:ed)?|published)\b", re.IGNORECASE)

# ---------------------------------------------------------------------------
# Compiled patterns for class / id attribute matching (fallback heuristics)
# ---------------------------------------------------------------------------

_PAT: dict[str, re.Pattern[str]] = {
    "name": re.compile(r"\bname\b", re.IGNORECASE),
    "title": re.compile(
        r"\b(title|position|rank|designation|role|jobtitle)\b", re.IGNORECASE
    ),
    "department": re.compile(
        r"\b(department|dept|division|program|school|college)\b", re.IGNORECASE
    ),
    "bio": re.compile(
        r"\b(bio|biography|about|overview|profile|summary)\b", re.IGNORECASE
    ),
    "publications": re.compile(
        r"\b(publication|publications|research|works|papers|articles)\b",
        re.IGNORECASE,
    ),
    "office_hours": re.compile(
        r"\b(office.?hour|officehour|hours|availability|schedule)\b", re.IGNORECASE
    ),
}

_RE_HEADING = re.compile(r"^h[1-6]$")


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------


def _attr_matches(tag: Tag, pattern: re.Pattern[str]) -> bool:
    """Return True if *id* or any *class* token of *tag* matches *pattern*."""
    for attr in ("id", "class", "data-label"):
        val = tag.get(attr)
        if val is None:
            continue
        text = " ".join(val) if isinstance(val, list) else val
        if pattern.search(text):
            return True
    return False


def _clean(text: str) -> str:
    """Collapse internal whitespace and strip edges."""
    return re.sub(r"\s+", " ", text).strip()


def _strip_noise(soup: BeautifulSoup) -> None:
    """
    Decompose tags that carry no extractable content.

    Removing scripts, styles, navigation, and footer boilerplate before any
    text extraction reduces false-positive matches on page-chrome text.
    """
    for tag in soup.find_all(["script", "style", "noscript", "iframe", "nav", "footer"]):
        tag.decompose()


def _find_section(soup: BeautifulSoup, pattern: re.Pattern[str]) -> Optional[Tag]:
    """Return the first block-level container whose class/id matches *pattern*."""
    for tag in soup.find_all(["section", "div", "article", "aside"]):
        if _attr_matches(tag, pattern):
            return tag
    return None


def _list_items_from(container: Tag) -> list[str]:
    """
    Collect non-empty text from ``<li>`` items inside *container*.

    Falls back to ``<p>`` tags when no list items are present.
    """
    items = [_clean(li.get_text()) for li in container.find_all("li")]
    items = [i for i in items if i]
    if items:
        return items
    return [_clean(p.get_text()) for p in container.find_all("p") if _clean(p.get_text())]


def _collect_after_heading(heading: Tag) -> list[str]:
    """
    Walk siblings after *heading*, collecting ``<li>`` / ``<p>`` text until
    the next heading of equal-or-higher rank is reached.
    """
    level = int(heading.name[1])
    parts: list[str] = []
    for sib in heading.find_next_siblings():
        if sib.name and _RE_HEADING.match(sib.name):
            if int(sib.name[1]) <= level:
                break
        if sib.name in ("ul", "ol"):
            for li in sib.find_all("li"):
                text = _clean(li.get_text())
                if text:
                    parts.append(text)
        elif sib.name == "p":
            text = _clean(sib.get_text())
            if text:
                parts.append(text)
    return parts


# ---------------------------------------------------------------------------
# Public extractor
# ---------------------------------------------------------------------------


class ProfileExtractor:
    """
    Extract a structured :class:`~pipeline_worker.parsers.models.FacultyProfile`
    from the raw HTML of a Dickinson faculty profile page.

    RFC-specified CSS selectors and regex patterns are tried first for each
    field; broader heuristic fallbacks are applied only when the canonical
    selector yields nothing.  Every extraction step is individually guarded
    with ``try/except`` so that a single missing or malformed field never
    aborts the full extraction.

    Example::

        extractor = ProfileExtractor()
        profile = extractor.extract(html_string, "https://www.dickinson.edu/...")
    """

    def __init__(self) -> None:
        self._oh_parser = OfficeHourParser()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def extract(self, html: str, source_url: str) -> FacultyProfile:
        """
        Parse *html* and return a fully-instantiated :class:`FacultyProfile`.

        :param html: Raw HTML content of the faculty profile page.
        :param source_url: Canonical URL; used as the profile's primary key.
        :returns: Validated :class:`FacultyProfile` instance.
        """
        soup = BeautifulSoup(html, "html.parser")
        _strip_noise(soup)

        # Sabbatical check runs first so downstream parsers can respect it.
        status = self._check_sabbatical(soup)

        name = self._safe_extract("name", self._extract_name, soup, "")
        title = self._safe_extract("title", self._extract_title, soup, "")
        department = self._safe_extract("department", self._extract_department, soup, "")
        email = self._safe_extract("email", self._extract_email, soup, None)
        phone_number = self._safe_extract("phone_number", self._extract_phone, soup, None)
        primary_building = self._safe_extract(
            "primary_building", self._extract_primary_building, soup, None
        )
        bio = self._safe_extract("bio", self._extract_bio, soup, None)
        publications = self._safe_extract("publications", self._extract_publications, soup, [])
        office_hours = self._safe_extract(
            "office_hours", self._extract_office_hours, soup, []
        )

        return FacultyProfile(
            source_url=source_url,
            name=name,
            title=title,
            department=department,
            email=email,
            phone_number=phone_number,
            primary_building=primary_building,
            bio=bio,
            publications=publications,
            office_hours=office_hours,
            status=status,
        )

    # ------------------------------------------------------------------
    # Generic guard
    # ------------------------------------------------------------------

    def _safe_extract(self, field: str, fn, soup: BeautifulSoup, default):
        """
        Call *fn(soup)* and return the result; on any exception log a warning
        and return *default* so that one broken field never aborts the pipeline.
        """
        try:
            return fn(soup)
        except Exception as exc:
            logger.warning("Error extracting '%s': %s", field, exc)
            return default

    # ------------------------------------------------------------------
    # Per-field extraction (private)
    # ------------------------------------------------------------------

    def _extract_name(self, soup: BeautifulSoup) -> str:
        # Strategy 1 (RFC) — <title> tag with "Profile of <Name>" pattern
        try:
            title_tag = soup.find("title")
            if title_tag:
                m = _RE_PROFILE_TITLE.search(_clean(title_tag.get_text()))
                if m:
                    name = m.group(1).strip()
                    if name:
                        return name
        except Exception as exc:
            logger.debug("Name strategy 1 failed: %s", exc)

        # Strategy 2 — inline element (span/p/h*) whose class/id signals "name"
        try:
            for tag in soup.find_all(["span", "p", "h1", "h2", "h3", "div"]):
                if _attr_matches(tag, _PAT["name"]):
                    text = _clean(tag.get_text())
                    if text:
                        return text
        except Exception as exc:
            logger.debug("Name strategy 2 failed: %s", exc)

        # Strategy 3 — iterate all <h1> tags, skip generic page-title headings
        # (e.g. "Faculty Profile"), and return the first substantive one.
        try:
            _PAGE_TITLE_LABELS = {"faculty profile", ""}
            for h1 in soup.find_all("h1"):
                text = _clean(h1.get_text())
                if text.lower() not in _PAGE_TITLE_LABELS:
                    return text
        except Exception as exc:
            logger.debug("Name strategy 3 failed: %s", exc)

        # Strategy 4 — <meta property="og:title"> or <meta name="title">
        try:
            for meta in soup.find_all("meta"):
                prop = (meta.get("property") or meta.get("name") or "").lower()
                if "title" in prop:
                    content = _clean(meta.get("content") or "")
                    if content:
                        return re.split(r"[|\-–—]", content)[0].strip()
        except Exception as exc:
            logger.debug("Name strategy 4 failed: %s", exc)

        # Fallback — plain <title> split on common separators
        try:
            title_tag = soup.find("title")
            if title_tag:
                text = _clean(title_tag.get_text())
                return re.split(r"[|\-–—]", text)[0].strip()
        except Exception as exc:
            logger.debug("Name fallback failed: %s", exc)

        logger.warning("Could not extract faculty name from page.")
        return ""

    def _extract_title(self, soup: BeautifulSoup) -> str:
        # Strategy 1 — Dickinson-specific structure: the page has two <h1> tags —
        # one generic "Faculty Profile" page title and one containing the professor's
        # name.  The title/rank string lives in the very next <p>/<em>/<span>/<h2>
        # after the *name* heading.  We use find_next() (document-order traversal,
        # not parent-scoped) to cross container boundaries.
        _PAGE_TITLE_LABELS = {"faculty profile", ""}
        _NAV_NOISE = {"faculty menu", "general info", "course info", "skip to"}
        try:
            for h1 in soup.find_all("h1"):
                if _clean(h1.get_text()).lower() in _PAGE_TITLE_LABELS:
                    continue
                # This h1 holds the professor's name — look for the title element
                # immediately following it anywhere in the document.
                candidate = h1.find_next(["p", "em", "span", "h2", "h3"])
                if not candidate:
                    continue
                text = _clean(candidate.get_text())
                if text and not any(kw in text.lower() for kw in _NAV_NOISE):
                    return text
        except Exception as exc:
            logger.debug("Title strategy 1 (Dickinson h1 traverse) failed: %s", exc)

        # Strategy 2 — element whose class/id signals "title" / "position"
        try:
            for tag in soup.find_all(["span", "p", "div", "h2", "h3"]):
                if _attr_matches(tag, _PAT["title"]):
                    text = _clean(tag.get_text())
                    if text:
                        return text
        except Exception as exc:
            logger.debug("Title strategy 2 failed: %s", exc)

        # Strategy 3 — <h2> or first block sibling immediately after *any* <h1>
        try:
            for h1 in soup.find_all("h1"):
                sibling = h1.find_next_sibling(["h2", "h3", "p", "span"])
                if sibling:
                    text = _clean(sibling.get_text())
                    if text and _clean(h1.get_text()).lower() not in _PAGE_TITLE_LABELS:
                        return text
        except Exception as exc:
            logger.debug("Title strategy 3 failed: %s", exc)

        logger.warning("Could not extract faculty title from page.")
        return ""

    def _normalize_department_name(self, raw_name: str) -> str:
        """
        Normalize a raw department string to a canonical, deduplicated form.

        Resolves ampersand variants (`&amp;`, ` & `, bare `&`) to the word
        "and" so that entity-resolution never splits the same department into
        two distinct rows.  Whitespace is collapsed as a final step to clean
        up any double-spaces introduced by the replacements.
        """
        name = raw_name.strip()
        name = name.replace("&amp;", "and")
        name = name.replace(" & ", " and ")
        name = name.replace("&", " and ")
        name = " ".join(name.split())
        return name

    def _extract_department(self, soup: BeautifulSoup) -> str:
        # Strategy 0 — parse from the faculty title string.
        # Dickinson title strings use two common formats:
        #   a) "Professor of <Department>" / "Instructor in <Department>"
        #   b) "Assistant Professor, <Department>"  (comma-separated)
        _RANK_WORDS = {
            "professor", "instructor", "lecturer", "faculty", "fellow",
            "scientist", "researcher", "scholar", "chair", "director",
            "visitor", "visiting", "adjunct", "emeritus", "emerita",
            "associate", "assistant", "distinguished", "clinical",
        }
        try:
            title_text = self._extract_title(soup)
            if title_text:
                # Pattern a: "… in Environmental Studies (2023)" or "… of Chemistry"
                m = re.search(
                    r"\b(?:in|of)\s+([A-Z][A-Za-z &\-/]+?)(?:\s*\(|\s*\d|[,;]|$)",
                    title_text,
                )
                if m:
                    dept = m.group(1).strip().rstrip(",;").strip()
                    if dept:
                        return self._normalize_department_name(dept)

                # Pattern b: "Assistant Professor, Computer Science"
                # The token after the comma must start with a capital letter and
                # not itself be a rank word (to avoid "Professor, Emeritus" cases).
                m2 = re.search(
                    r",\s+([A-Z][A-Za-z &\-/]+?)(?:\s*\(|\s*\d|[,;]|$)",
                    title_text,
                )
                if m2:
                    candidate = m2.group(1).strip().rstrip(",;").strip()
                    if candidate and candidate.split()[0].lower() not in _RANK_WORDS:
                        return self._normalize_department_name(candidate)
        except Exception as exc:
            logger.debug("Department strategy 0 (from title string) failed: %s", exc)

        # Strategy 1 — element whose class/id signals "department"
        try:
            for tag in soup.find_all(["span", "p", "div", "h2", "h3", "a"]):
                if _attr_matches(tag, _PAT["department"]):
                    text = _clean(tag.get_text())
                    if text:
                        return self._normalize_department_name(text)
        except Exception as exc:
            logger.debug("Department strategy 1 failed: %s", exc)

        # Strategy 2 — heading labelled "Department" → adjacent value element
        try:
            for heading in soup.find_all(_RE_HEADING):
                label = _clean(heading.get_text()).lower()
                if any(kw in label for kw in ("department", "school", "program", "division")):
                    value_tag = heading.find_next_sibling(["p", "span", "div", "a"])
                    if value_tag:
                        text = _clean(value_tag.get_text())
                        if text:
                            return self._normalize_department_name(text)
        except Exception as exc:
            logger.debug("Department strategy 2 failed: %s", exc)

        # Strategy 3 — <dt> "Department" → following <dd>
        try:
            for dt in soup.find_all("dt"):
                label = _clean(dt.get_text()).lower()
                if any(kw in label for kw in ("department", "school", "program")):
                    dd = dt.find_next_sibling("dd")
                    if dd:
                        text = _clean(dd.get_text())
                        if text:
                            return self._normalize_department_name(text)
        except Exception as exc:
            logger.debug("Department strategy 3 failed: %s", exc)

        logger.warning("Could not extract department from page.")
        return ""

    def _extract_email(self, soup: BeautifulSoup) -> Optional[str]:
        # Strategy 1 — search exclusively within the "Contact Information" section.
        # Dickinson profile pages embed a mailto:webmaster@dickinson.edu link in
        # the page header *before* the faculty's own email; restricting the search
        # to the contact section's siblings prevents that link from being captured.
        try:
            for h3 in soup.find_all("h3"):
                if "contact" not in _clean(h3.get_text()).lower():
                    continue
                for sib in h3.find_next_siblings():
                    if sib.name == "h3":
                        break
                    # Handle the case where the sibling itself is an <a> tag.
                    candidates = []
                    if sib.name == "a":
                        candidates.append(sib)
                    candidates.extend(sib.find_all("a", href=True))
                    for a in candidates:
                        href: str = a.get("href", "")
                        if not href.startswith("mailto:"):
                            continue
                        address = href[len("mailto:"):].split("?")[0].strip()
                        if _RE_EMAIL_DICKINSON.match(address):
                            return address
        except Exception as exc:
            logger.debug("Email strategy 1 (contact section) failed: %s", exc)

        # Strategy 2 — scan mailto: links scoped to .faculty-contact-info.
        # Dickinson profile pages place the professor's personal contact link
        # inside this container; scanning the whole page risks capturing a
        # shared institutional address from the page header or footer that
        # would map every professor to the same database row.
        try:
            contact_block = soup.select_one(".faculty-contact-info")
            if contact_block:
                for a in contact_block.select('a[href^="mailto:"]'):
                    href = a.get("href", "")
                    address = href[len("mailto:"):].split("?")[0].strip()
                    if _RE_EMAIL_DICKINSON.match(address) and not _RE_INSTITUTIONAL_EMAIL.match(address):
                        return address
                    if address:
                        logger.debug("Skipping non-personal email address: %r", address)
        except Exception as exc:
            logger.debug("Email strategy 2 (.faculty-contact-info) failed: %s", exc)

        # Strategy 3 — last-resort: scan all mailto: links on the page but
        # only within the lower half of the DOM (after stripping nav/header).
        # This avoids the shared-footer email that causes UUID collisions while
        # still recovering the address from pages with non-standard structure.
        try:
            main = soup.select_one("main, #main-content, .main-content, article, #content, .content")
            search_root = main if main else soup
            for a in search_root.select('a[href^="mailto:"]'):
                href = a.get("href", "")
                address = href[len("mailto:"):].split("?")[0].strip()
                if _RE_EMAIL_DICKINSON.match(address) and not _RE_INSTITUTIONAL_EMAIL.match(address):
                    return address
                if address:
                    logger.debug("Skipping non-personal email address: %r", address)
        except Exception as exc:
            logger.warning("Error extracting email (strategy 3): %s", exc)
        return None

    def _extract_phone(self, soup: BeautifulSoup) -> Optional[str]:
        # Strategy 1 (RFC) — search inside .faculty-contact-info
        try:
            contact = soup.select_one(".faculty-contact-info")
            if contact:
                m = _RE_PHONE.search(contact.get_text())
                if m:
                    return m.group(0)
        except Exception as exc:
            logger.debug("Phone strategy 1 failed: %s", exc)

        # Fallback — scan the whole page
        try:
            m = _RE_PHONE.search(soup.get_text())
            if m:
                return m.group(0)
        except Exception as exc:
            logger.debug("Phone fallback failed: %s", exc)

        return None

    def _extract_bio(self, soup: BeautifulSoup) -> Optional[str]:
        # Strategy 1 (RFC) — <h3> containing "Bio", collect <p> siblings until
        #                      the next <h3>
        try:
            for h3 in soup.find_all("h3"):
                if "bio" in _clean(h3.get_text()).lower():
                    parts: list[str] = []
                    for sib in h3.find_next_siblings():
                        if sib.name == "h3":
                            break
                        if sib.name == "p":
                            text = _clean(sib.get_text())
                            if text:
                                parts.append(text)
                    if parts:
                        return " ".join(parts)
        except Exception as exc:
            logger.debug("Bio strategy 1 failed: %s", exc)

        # Strategy 2 — block container with bio-related class/id
        try:
            container = _find_section(soup, _PAT["bio"])
            if container:
                paragraphs = [_clean(p.get_text()) for p in container.find_all("p")]
                text = " ".join(p for p in paragraphs if p)
                if text:
                    return text
        except Exception as exc:
            logger.debug("Bio strategy 2 failed: %s", exc)

        # Strategy 3 — any heading labelled "Biography" / "About" etc.
        try:
            for heading in soup.find_all(_RE_HEADING):
                label = _clean(heading.get_text()).lower()
                if any(kw in label for kw in ("bio", "about", "biography", "overview", "profile")):
                    parts = []
                    for sib in heading.find_next_siblings():
                        if sib.name and _RE_HEADING.match(sib.name):
                            break
                        if sib.name == "p":
                            text = _clean(sib.get_text())
                            if text:
                                parts.append(text)
                    if parts:
                        return " ".join(parts)
        except Exception as exc:
            logger.debug("Bio strategy 3 failed: %s", exc)

        return None

    def _extract_publications(self, soup: BeautifulSoup) -> list[str]:
        # Strategy 1 (RFC basic) — quoted titles in bio sentences that mention
        #                           "author" or "published"
        try:
            bio_text = self._extract_bio(soup) or ""
            if bio_text:
                titles: list[str] = []
                seen: set[str] = set()
                for sentence in re.split(r"[.!?]", bio_text):
                    if _RE_PUB_CONTEXT.search(sentence):
                        for m in _RE_QUOTED_TITLE.finditer(sentence):
                            title = m.group(1).strip()
                            if title and title not in seen:
                                titles.append(title)
                                seen.add(title)
                if titles:
                    return titles
        except Exception as exc:
            logger.debug("Publications strategy 1 failed: %s", exc)

        # Strategy 2 — block container with publications-related class/id
        try:
            container = _find_section(soup, _PAT["publications"])
            if container:
                items = _list_items_from(container)
                if items:
                    return items
        except Exception as exc:
            logger.debug("Publications strategy 2 failed: %s", exc)

        # Strategy 3 — heading labelled "Publications" / "Research" etc.
        try:
            for heading in soup.find_all(_RE_HEADING):
                label = _clean(heading.get_text()).lower()
                if any(kw in label for kw in ("publication", "paper", "research", "work")):
                    items = _collect_after_heading(heading)
                    if items:
                        return items
        except Exception as exc:
            logger.debug("Publications strategy 3 failed: %s", exc)

        return []

    def _extract_office_hours(self, soup: BeautifulSoup) -> list[OfficeHourSlot]:
        raw = self._safe_extract(
            "office_hours_raw", self._extract_office_hours_raw, soup, None
        )
        if not raw:
            return []
        logger.debug("Raw office hours string: %r", raw)
        return self._oh_parser.parse(raw)

    def _extract_office_hours_raw(self, soup: BeautifulSoup) -> Optional[str]:
        # Strategy 1 (RFC) — departmental hours table inside .faculty-contact-info
        try:
            contact = soup.select_one(".faculty-contact-info")
            if contact:
                # Prefer a <table> inside the contact block
                table = contact.find("table")
                if table:
                    text = _clean(table.get_text(" ", strip=True))
                    if text:
                        return text
                # Fall back to the full contact block text
                text = _clean(contact.get_text())
                if text:
                    return text
        except Exception as exc:
            logger.debug("Office hours strategy 1 failed: %s", exc)

        # Strategy 2 — any <table> whose surrounding heading mentions "office hours"
        try:
            for heading in soup.find_all(_RE_HEADING):
                label = _clean(heading.get_text()).lower()
                if "office" in label and "hour" in label:
                    table = heading.find_next_sibling("table")
                    if table:
                        text = _clean(table.get_text(" ", strip=True))
                        if text:
                            return text
                    # Collect <p> siblings as a fallback within the same section
                    parts: list[str] = []
                    for sib in heading.find_next_siblings():
                        if sib.name and _RE_HEADING.match(sib.name):
                            break
                        text = _clean(sib.get_text())
                        if text:
                            parts.append(text)
                    if parts:
                        return " ".join(parts)
        except Exception as exc:
            logger.debug("Office hours strategy 2 failed: %s", exc)

        # Strategy 3 — block container with office-hours-related class/id
        try:
            container = _find_section(soup, _PAT["office_hours"])
            if container:
                text = _clean(container.get_text())
                if text:
                    return text
        except Exception as exc:
            logger.debug("Office hours strategy 3 failed: %s", exc)

        # Strategy 4 — <dt> "Office Hours" → following <dd>
        try:
            for dt in soup.find_all("dt"):
                label = _clean(dt.get_text()).lower()
                if "office" in label and "hour" in label:
                    dd = dt.find_next_sibling("dd")
                    if dd:
                        return _clean(dd.get_text())
        except Exception as exc:
            logger.debug("Office hours strategy 4 failed: %s", exc)

        # Strategy 5 — inline "Office Hours: ..." label
        try:
            for tag in soup.find_all(["p", "span", "li", "td"]):
                text = _clean(tag.get_text())
                match = re.search(r"office\s+hours?\s*[:\-–]?\s*(.+)", text, re.IGNORECASE)
                if match:
                    value = match.group(1).strip()
                    if value:
                        return value
        except Exception as exc:
            logger.debug("Office hours strategy 5 failed: %s", exc)

        return None

    def _extract_primary_building(self, soup: BeautifulSoup) -> Optional[str]:
        """
        Extract the primary campus building name from the faculty contact block.

        Dickinson profile pages embed the office location inside the
        ``.faculty-contact-info`` container, typically as free-form text
        adjacent to the phone number and email.  We scan that block first
        (most reliable), then fall back to any heading labelled "Office" or
        "Location", then to a broader page scan.

        Returns the matched building name string, or ``None`` when not found.
        """
        # Strategy 1 — preferred: scan .faculty-contact-info for a building name.
        # This is the same container used by phone / email / sabbatical checks so
        # the selector is already validated against live Dickinson pages.
        try:
            contact = soup.select_one(".faculty-contact-info")
            if contact:
                text = _clean(contact.get_text())
                m = _RE_BUILDING.search(text)
                if m:
                    return _clean(m.group(1))
        except Exception as exc:
            logger.debug("Building strategy 1 (.faculty-contact-info) failed: %s", exc)

        # Strategy 2 — <dt> / <dd> pattern: "Office:" → following text
        try:
            for dt in soup.find_all("dt"):
                label = _clean(dt.get_text()).lower()
                if any(kw in label for kw in ("office", "location", "building")):
                    dd = dt.find_next_sibling("dd")
                    if dd:
                        text = _clean(dd.get_text())
                        m = _RE_BUILDING.search(text)
                        if m:
                            return _clean(m.group(1))
        except Exception as exc:
            logger.debug("Building strategy 2 (dt/dd) failed: %s", exc)

        # Strategy 3 — heading "Office" / "Location" → sibling paragraph
        try:
            for heading in soup.find_all(_RE_HEADING):
                label = _clean(heading.get_text()).lower()
                if any(kw in label for kw in ("office", "location", "building")):
                    sib = heading.find_next_sibling(["p", "span", "div"])
                    if sib:
                        text = _clean(sib.get_text())
                        m = _RE_BUILDING.search(text)
                        if m:
                            return _clean(m.group(1))
        except Exception as exc:
            logger.debug("Building strategy 3 (heading sibling) failed: %s", exc)

        return None

    def _check_sabbatical(self, soup: BeautifulSoup) -> Optional[str]:
        """
        Return ``"sabbatical"`` when the contact block (or broader page text)
        contains the phrase "on sabbatical"; ``None`` otherwise.
        """
        try:
            contact = soup.select_one(".faculty-contact-info")
            if contact and _RE_SABBATICAL.search(contact.get_text()):
                logger.info("Sabbatical status detected in contact block.")
                return "sabbatical"
        except Exception as exc:
            logger.debug("Sabbatical contact-block check failed: %s", exc)

        try:
            if _RE_SABBATICAL.search(soup.get_text()):
                logger.info("Sabbatical status detected on page.")
                return "sabbatical"
        except Exception as exc:
            logger.debug("Sabbatical full-page check failed: %s", exc)

        return None
