"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ChevronLeft, GraduationCap } from "lucide-react";
import { Button } from "@/ui/button";
import { ScrollArea } from "@/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/ui/accordion";
import ProfessorCard from "./ProfessorCard";

import { getPublicApiUrl } from "@/lib/env.js";

const API_URL = getPublicApiUrl();

async function fetchProfessorsByBuilding(buildingId) {
  const { data: body } = await axios.get(
    `${API_URL}/api/professors?building_id=${encodeURIComponent(buildingId)}&limit=100`
  );
  if (body.error) throw new Error(body.error);
  return body.data;
}

export default function BuildingDirectory({
  buildingId,
  building,
  onBack,
  buildings = [],
  mapRef,
}) {
  const {
    data: professors = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["professors", "building", buildingId],
    queryFn: () => fetchProfessorsByBuilding(buildingId),
    enabled: !!buildingId,
    staleTime: 60_000,
  });

  const grouped = useMemo(() => {
    const map = new Map();
    for (const prof of professors) {
      const deptName = prof.departments?.name ?? "Other";
      if (!map.has(deptName)) map.set(deptName, []);
      map.get(deptName).push(prof);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [professors]);

  const imageSrc = building?.image || null;
  const buildingName = building?.name || "Building";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Hero: building image + name + back button */}
      <div className="relative shrink-0">
        <div className="relative h-36 sm:h-44 md:h-48 overflow-hidden">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={buildingName}
              fill
              quality={80}
              style={{ objectFit: "cover" }}
              className="brightness-75"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
          )}

          {/* Bottom gradient for legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19]/90 via-[#0B0F19]/20 to-transparent" />

          {/* Back button */}
          <div className="absolute top-3 left-3 z-10 pt-[env(safe-area-inset-top)]">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="flex items-center gap-1.5 bg-black/50 hover:bg-black/70 active:bg-black/60 text-white border border-white/20 rounded-xl backdrop-blur-sm min-h-11 px-3 text-xs sm:text-sm font-semibold transition-all duration-200"
            >
              <ChevronLeft size="14px" className="shrink-0" />
              <span className="hidden xs:inline">Back to Campus</span>
              <span className="xs:hidden">Back</span>
            </Button>
          </div>

          {/* Building name */}
          <div className="absolute bottom-3 left-3 right-3 sm:left-4 sm:right-4 z-10">
            <h2 className="text-lg sm:text-xl font-bold text-white drop-shadow-lg leading-tight break-words">
              {buildingName}
            </h2>
            {!isLoading && !isError && professors.length > 0 && (
              <p className="text-xs text-white/60 mt-0.5 font-medium">
                {professors.length} faculty member{professors.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Department accordion list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 py-4">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
              <p className="text-sm text-muted-foreground">Loading faculty…</p>
            </div>
          )}

          {isError && (
            <p className="text-sm text-destructive text-center py-10">
              Failed to load faculty data. Please try again.
            </p>
          )}

          {!isLoading && !isError && grouped.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <GraduationCap size="32px" className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No faculty listed for this building.
              </p>
            </div>
          )}

          {!isLoading && !isError && grouped.length > 0 && (
            <Accordion type="multiple" className="space-y-1.5">
              {grouped.map(([deptName, profs]) => (
                <AccordionItem
                  key={deptName}
                  value={deptName}
                  className="border border-white/[0.08] rounded-xl bg-white/[0.02] overflow-hidden"
                >
                  <AccordionTrigger className="px-4 py-3 min-h-11 hover:no-underline hover:bg-white/[0.04] active:bg-white/[0.06] rounded-xl transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0 mr-2">
                      <span className="text-sm font-semibold text-white truncate">
                        {deptName}
                      </span>
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 border border-blue-500/25 text-blue-300 leading-none">
                        {profs.length}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3 pt-1">
                    <div className="space-y-3">
                      {profs.map((prof) => (
                        <ProfessorCard
                          key={prof.id ?? prof.email}
                          professor={prof}
                          buildings={buildings}
                          mapRef={mapRef}
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
