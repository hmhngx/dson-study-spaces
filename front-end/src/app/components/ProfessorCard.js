"use client";

import React from "react";
import { MapPin, Mail, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function formatTime(timeStr) {
  if (!timeStr) return "";
  const [hour, minute] = timeStr.split(":").map(Number);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${h}:${String(minute).padStart(2, "0")} ${ampm}`;
}

function matchBuildingFromLocation(location, buildings) {
  if (!location || !buildings?.length) return null;
  const loc = location.toLowerCase();
  return (
    buildings.find((b) => {
      const name = (b.name ?? "").toLowerCase();
      if (!name) return false;
      const firstWord = loc.split(/[\s,]/)[0];
      return loc.includes(name) || (name.length > 3 && name.includes(firstWord));
    }) ?? null
  );
}

function groupOfficeHours(hours) {
  const map = new Map();
  for (const oh of hours) {
    const key = `${oh.start_time ?? ""}|${oh.end_time ?? ""}|${oh.location ?? ""}`;
    if (!map.has(key)) {
      map.set(key, { ...oh, days: oh.day ? [oh.day] : [] });
    } else {
      if (oh.day) map.get(key).days.push(oh.day);
    }
  }
  return Array.from(map.values());
}

export default function ProfessorCard({ professor, buildings = [], mapRef, onLocate, onHighlight }) {
  const {
    name,
    title,
    departments,
    email,
    bio,
    professor_office_hours = [],
  } = professor;

  const activeHours = professor_office_hours.filter(
    (oh) => oh.day || oh.start_time || oh.end_time || oh.location
  );
  const groupedHours = groupOfficeHours(activeHours);

  const uniqueLocations = [
    ...new Set(activeHours.map((oh) => oh.location).filter(Boolean)),
  ];

  const handleLocate = (location) => {
    const building = matchBuildingFromLocation(location, buildings);
    if (building?.coords) {
      mapRef?.current?.flyToLocation(building.coords[0], building.coords[1]);
      onHighlight?.(building.id);
      onLocate?.();
    }
  };

  const badges = [title, departments?.name].filter(Boolean);

  return (
    <div
      className={cn(
        "group flex flex-col gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl w-full min-w-0",
        "bg-gradient-to-br from-white/[0.08] to-white/[0.02]",
        "border border-white/[0.12]",
        "shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] backdrop-blur-md",
        "hover:border-white/[0.2] active:border-white/[0.18] transition-all duration-300"
      )}
    >
      <div className="flex flex-col gap-2.5 min-w-0">
        <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white drop-shadow-md leading-snug break-words">
          {name}
        </h3>

        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <span
                key={badge}
                className="px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-200 text-xs font-semibold tracking-wide uppercase max-w-full truncate"
              >
                {badge}
              </span>
            ))}
          </div>
        )}

        {email && (
          <a
            href={`mailto:${email}`}
            className="flex items-center gap-2 min-w-0 max-w-full text-sm text-blue-400 hover:text-blue-300 active:text-blue-200 transition-colors mt-0.5 min-h-11"
          >
            <Mail className="w-4 h-4 shrink-0 text-blue-400" />
            <span className="truncate">{email}</span>
          </a>
        )}
      </div>

      {bio && (
        <p className="text-sm text-gray-300 leading-relaxed font-light line-clamp-3 sm:line-clamp-4">
          {bio}
        </p>
      )}

      {groupedHours.length > 0 && (
        <div className="flex flex-col gap-2.5 min-w-0">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent my-1" />

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">
              Office Hours
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {groupedHours.map((oh, i) => {
              const dayLabel = oh.days.length > 0 ? oh.days.join(" & ") : null;
              const timeLabel =
                oh.start_time && oh.end_time
                  ? `${formatTime(oh.start_time)} – ${formatTime(oh.end_time)}`
                  : null;
              const rowLabel = [dayLabel, timeLabel].filter(Boolean).join(" • ");

              return (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05]"
                >
                  <p className="text-sm font-medium text-emerald-100/90 break-words min-w-0">
                    {rowLabel || oh.location || "—"}
                  </p>
                  {oh.location && rowLabel && (
                    <span className="text-[10px] text-white/40 shrink-0 sm:max-w-[40%] sm:truncate">
                      {oh.location}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {uniqueLocations.length > 0 && (
        <div className="flex flex-col gap-2 mt-auto w-full">
          {uniqueLocations.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => handleLocate(loc)}
              className={cn(
                "touch-target-inline w-full min-h-11 py-3 rounded-xl",
                "bg-blue-600/20 hover:bg-blue-600/30 active:bg-blue-600/40",
                "border border-blue-500/30 hover:border-blue-500/50",
                "text-blue-200 text-sm font-semibold",
                "flex items-center justify-center gap-2",
                "transition-all duration-300",
                "hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]"
              )}
            >
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {uniqueLocations.length > 1 ? `Locate ${loc}` : "Locate Office"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
