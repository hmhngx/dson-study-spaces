"""
Pydantic v2 data models for faculty profile extraction pipeline.

Provides strict, validated data contracts for OfficeHourSlot and FacultyProfile
to ensure type safety and schema consistency across the extraction pipeline.
"""

from __future__ import annotations

import hashlib
from datetime import time
from typing import Optional

from pydantic import BaseModel, Field, computed_field


class OfficeHourSlot(BaseModel):
    """
    Represents a single office hour time slot for a faculty member.

    Day-of-week follows Python convention: Monday=0, Sunday=6.
    Times may be null when is_by_appointment is True or when only
    qualitative information is available.
    """

    day_of_week: int = Field(
        ...,
        ge=0,
        le=6,
        description="Day of week (0=Monday, 6=Sunday) per Python convention.",
    )
    start_time: Optional[time] = Field(
        default=None,
        description="Start time of the slot. Null when by-appointment or unknown.",
    )
    end_time: Optional[time] = Field(
        default=None,
        description="End time of the slot. Null when by-appointment or unknown.",
    )
    is_by_appointment: bool = Field(
        default=False,
        description="Whether office hours are by appointment only.",
    )
    location: Optional[str] = Field(
        default=None,
        description="Physical location (e.g., room number, building name).",
    )


class FacultyProfile(BaseModel):
    """
    Canonical faculty profile extracted from source pages.

    All extracted faculty data conforms to this schema. The `id` field
    is a deterministic MD5 hash of `source_url` for deduplication and
    idempotent pipeline runs.
    """

    source_url: str = Field(
        ...,
        description="Canonical URL of the faculty profile page.",
    )
    name: str = Field(
        ...,
        description="Full name of the faculty member.",
    )
    title: str = Field(
        ...,
        description="Academic rank or position title.",
    )
    department: str = Field(
        ...,
        description="Department or program affiliation.",
    )
    email: Optional[str] = Field(
        default=None,
        description="Contact email address.",
    )
    phone_number: Optional[str] = Field(
        default=None,
        description="Office phone number in NXX-NXX-XXXX format.",
    )
    status: Optional[str] = Field(
        default=None,
        description="Faculty status flag (e.g. 'sabbatical'). None implies active.",
    )
    primary_building: Optional[str] = Field(
        default=None,
        description="Name of the primary campus building where the faculty member's office is located (e.g. 'Tome Scientific Building', 'Althouse Hall').",
    )
    bio: Optional[str] = Field(
        default=None,
        description="Unstructured biographical text.",
    )
    publications: list[str] = Field(
        default_factory=list,
        description="List of publication references or titles.",
    )
    office_hours: list[OfficeHourSlot] = Field(
        default_factory=list,
        description="Parsed office hour slots.",
    )

    @computed_field
    @property
    def id(self) -> str:
        """
        Deterministic MD5 hash of source_url for unique identification.

        Enables idempotent pipeline runs and cross-run deduplication
        without relying on external IDs.
        """
        return hashlib.md5(self.source_url.encode(encoding="utf-8")).hexdigest()
