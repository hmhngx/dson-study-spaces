"""
Temporal string parsing engine for faculty office hour strings.

Handles highly variant natural-language formats using a compiled-regex FSM
approach: tokenise days, extract time ranges, infer AM/PM meridiem, and
assemble validated OfficeHourSlot instances.
"""

from __future__ import annotations

import logging
import re
from datetime import time
from typing import Optional

from pipeline_worker.parsers.models import OfficeHourSlot

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Day-name vocabulary
# ---------------------------------------------------------------------------

_DAY_MAP: dict[str, int] = {
    "monday": 0,
    "mon": 0,
    "tuesday": 1,
    "tues": 1,
    "tue": 1,
    "tu": 1,
    "wednesday": 2,
    "wed": 2,
    "thursday": 3,
    "thurs": 3,
    "thur": 3,
    "thu": 3,
    "th": 3,
    "friday": 4,
    "fri": 4,
    "saturday": 5,
    "sat": 5,
    "sunday": 6,
    "sun": 6,
}

# ---------------------------------------------------------------------------
# Compiled regex patterns
# ---------------------------------------------------------------------------

# Ordered longest-first so alternation resolves greedily and `th` never
# swallows the first two letters of "thursday" before the longer form matches.
_RE_DAYS = re.compile(
    r"\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday"
    r"|thurs|tues|mon|tue|wed|thu|fri|sat|sun|th|tu)\b",
    re.IGNORECASE,
)

# Captures: (start_time_str, start_ampm, end_time_str, end_ampm)
# Supports both hyphen-minus and en-dash as range separators.
_RE_TIME_RANGE = re.compile(
    r"(\d{1,2}(?::\d{2})?)\s*(am|pm)?\s*[-\u2013]\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)?",
    re.IGNORECASE,
)

_RE_APPOINTMENT = re.compile(r"\bappointment\b", re.IGNORECASE)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _parse_hm(token: str) -> tuple[int, int]:
    """Split a time token such as '1:30' or '9' into (hour, minute)."""
    if ":" in token:
        h, m = token.split(":", 1)
        return int(h), int(m)
    return int(token), 0


def _apply_ampm(hour: int, minute: int, ampm: Optional[str]) -> time:
    """Convert (hour, minute, ampm) to a :class:`datetime.time` (24-hour)."""
    if ampm:
        meridiem = ampm.lower()
        if meridiem == "pm" and hour != 12:
            hour += 12
        elif meridiem == "am" and hour == 12:
            hour = 0
    return time(hour, minute)


def _infer_start_ampm(
    start_hour: int,
    end_hour: int,
    end_ampm: Optional[str],
    start_ampm: Optional[str],
) -> Optional[str]:
    """
    Infer the AM/PM for the start time when it is not explicitly annotated.

    Rules (common office-hours conventions):
      - If end is PM and start_hour == 12  → start is noon (PM).
      - If end is PM and start_hour > end_hour → cross-meridiem; start is AM.
      - If end is PM and start_hour <= end_hour → same meridiem; start is PM.
      - If end is AM → start is also AM.
      - If neither end nor start carry AM/PM annotation, leave as-is (caller
        treats the integers as 24-hour values already).
    """
    if start_ampm:
        return start_ampm
    if not end_ampm:
        return None
    meridiem = end_ampm.lower()
    if meridiem == "pm":
        if start_hour == 12:
            return "pm"
        return "am" if start_hour > end_hour else "pm"
    # end is AM
    return "am"


def _build_time_range(
    start_str: str,
    raw_start_ampm: str,
    end_str: str,
    raw_end_ampm: str,
) -> tuple[time, time]:
    """Parse a captured time-range regex match into a (start, end) time pair."""
    start_ampm: Optional[str] = raw_start_ampm or None
    end_ampm: Optional[str] = raw_end_ampm or None

    sh, sm = _parse_hm(start_str)
    eh, em = _parse_hm(end_str)

    resolved_start_ampm = _infer_start_ampm(sh, eh, end_ampm, start_ampm)

    start_t = _apply_ampm(sh, sm, resolved_start_ampm)
    end_t = _apply_ampm(eh, em, end_ampm)
    return start_t, end_t


# ---------------------------------------------------------------------------
# Public parser
# ---------------------------------------------------------------------------


class OfficeHourParser:
    """
    Robust parser for unstructured office-hour strings.

    Uses a compiled-regex finite-state approach: lex day tokens and time-range
    tokens independently, then cross-join them into :class:`OfficeHourSlot`
    instances.  Logs a warning and returns ``[]`` on complete parse failure
    rather than propagating an exception.
    """

    def parse(self, raw_string: str) -> list[OfficeHourSlot]:
        """
        Parse *raw_string* into a list of :class:`OfficeHourSlot` objects.

        Returns an empty list when:
          - The string yields no days and no time ranges (warning is logged).
          - The string is "by appointment only" with no accompanying day
            (no valid :class:`OfficeHourSlot` can be constructed without a
            ``day_of_week``).
          - An unexpected exception is raised during parsing (warning logged).
        """
        try:
            return self._parse(raw_string)
        except Exception as exc:  # pragma: no cover
            logger.warning(
                "Unexpected error parsing office hour string %r: %s", raw_string, exc
            )
            return []

    # ------------------------------------------------------------------
    # Private implementation
    # ------------------------------------------------------------------

    def _parse(self, raw_string: str) -> list[OfficeHourSlot]:
        has_appointment = bool(_RE_APPOINTMENT.search(raw_string))

        # --- Lex days -------------------------------------------------
        day_tokens = _RE_DAYS.findall(raw_string)
        days: list[int] = []
        seen: set[int] = set()
        for tok in day_tokens:
            key = tok.lower()
            # Prevent double-mapping: "thursday" may not appear as both
            # "thurs" and "thu" in a single string, but guard anyway.
            if key in _DAY_MAP:
                val = _DAY_MAP[key]
                if val not in seen:
                    days.append(val)
                    seen.add(val)

        # --- Lex time ranges ------------------------------------------
        time_matches = _RE_TIME_RANGE.findall(raw_string)

        # --- Edge: pure "by appointment" with no day info -------------
        if not days and not time_matches:
            if has_appointment:
                # Cannot construct a valid OfficeHourSlot without day_of_week.
                logger.debug(
                    "Office hour string is appointment-only with no day: %r", raw_string
                )
                return []
            logger.warning(
                "Could not extract any day or time information from: %r", raw_string
            )
            return []

        slots: list[OfficeHourSlot] = []

        if time_matches:
            for day in days:
                for match in time_matches:
                    start_str, raw_start_ampm, end_str, raw_end_ampm = match
                    start_t, end_t = _build_time_range(
                        start_str, raw_start_ampm, end_str, raw_end_ampm
                    )
                    slots.append(
                        OfficeHourSlot(
                            day_of_week=day,
                            start_time=start_t,
                            end_time=end_t,
                            is_by_appointment=False,
                        )
                    )
            # "… OR by appointment" — also add appointment slots per day.
            if has_appointment:
                for day in days:
                    slots.append(
                        OfficeHourSlot(
                            day_of_week=day,
                            is_by_appointment=True,
                        )
                    )
        elif has_appointment:
            # Days present, no time range — pure appointment days.
            for day in days:
                slots.append(
                    OfficeHourSlot(
                        day_of_week=day,
                        is_by_appointment=True,
                    )
                )
        else:
            logger.warning(
                "Found day token(s) but no time range or appointment in: %r", raw_string
            )

        return slots


# ---------------------------------------------------------------------------
# Smoke tests
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = OfficeHourParser()

    # --- "Monday 1:30-2:30pm" ------------------------------------------
    r1 = parser.parse("Monday 1:30-2:30pm")
    assert len(r1) == 1, f"Expected 1 slot, got {len(r1)}"
    assert r1[0].day_of_week == 0, "Monday should be 0"
    assert r1[0].start_time == time(13, 30), f"Expected 13:30, got {r1[0].start_time}"
    assert r1[0].end_time == time(14, 30), f"Expected 14:30, got {r1[0].end_time}"
    assert not r1[0].is_by_appointment
    print("PASS  'Monday 1:30-2:30pm'")

    # --- "Mon/Wed 9:00-10:00am" ----------------------------------------
    r2 = parser.parse("Mon/Wed 9:00-10:00am")
    assert len(r2) == 2, f"Expected 2 slots, got {len(r2)}"
    days2 = {s.day_of_week for s in r2}
    assert days2 == {0, 2}, f"Expected Monday+Wednesday, got {days2}"
    for s in r2:
        assert s.start_time == time(9, 0), f"Expected 09:00, got {s.start_time}"
        assert s.end_time == time(10, 0), f"Expected 10:00, got {s.end_time}"
    print("PASS  'Mon/Wed 9:00-10:00am'")

    # --- "Tue 3:00-4:30pm OR by appointment" ---------------------------
    r3 = parser.parse("Tue 3:00-4:30pm OR by appointment")
    timed = [s for s in r3 if not s.is_by_appointment]
    appt = [s for s in r3 if s.is_by_appointment]
    assert len(timed) == 1, f"Expected 1 timed slot, got {len(timed)}"
    assert timed[0].day_of_week == 1, "Tuesday should be 1"
    assert timed[0].start_time == time(15, 0), f"Expected 15:00, got {timed[0].start_time}"
    assert timed[0].end_time == time(16, 30), f"Expected 16:30, got {timed[0].end_time}"
    assert len(appt) == 1, f"Expected 1 appointment slot, got {len(appt)}"
    assert appt[0].day_of_week == 1
    print("PASS  'Tue 3:00-4:30pm OR by appointment'")

    # --- "By appointment only" -----------------------------------------
    # No day_of_week is present; parser correctly returns an empty list
    # since OfficeHourSlot requires a day.
    r4 = parser.parse("By appointment only")
    assert isinstance(r4, list) and r4 == [], (
        f"Expected empty list for appointment-only string, got {r4}"
    )
    print("PASS  'By appointment only'")

    print("\nAll assertions passed.")
