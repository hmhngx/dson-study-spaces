"use client";

import React, { useState, useEffect, useRef } from "react";
import { useDebounce } from "use-debounce";
import { Search, X, GraduationCap, ChevronDown, Check } from "lucide-react";
import { Button } from "@/ui/button";
import { ScrollArea } from "@/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useProfessors } from "@/hooks/useProfessors";
import { useDepartments } from "@/hooks/useDepartments";
import ProfessorCard from "./ProfessorCard";
import { isProfessorInOffice } from "../../../services/liveMode";

export default function ProfessorSearch({ mapRef, buildings = [], className, inline = false, onHighlight, isLiveModeActive = false }) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [selectedDeptName, setSelectedDeptName] = useState("All Departments");
  const [debouncedSearch] = useDebounce(searchTerm, 300);
  const searchInputRef = useRef(null);

  const { data: departments = [] } = useDepartments();
  const {
    data: professors = [],
    isLoading,
    isError,
  } = useProfessors(debouncedSearch, selectedDeptId);

  const displayedProfessors = isLiveModeActive
    ? professors.filter(isProfessorInOffice)
    : professors;

  // Two-phase mount for CSS slide-in transition
  useEffect(() => {
    if (open) {
      // Mount first, then add visible class on next frame for transition
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
    }
  }, [open]);

  // Auto-focus search input when panel opens
  useEffect(() => {
    if (visible && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [visible]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const handleClose = () => {
    setVisible(false);
    // Wait for slide-out transition before unmounting
    setTimeout(() => setOpen(false), 300);
  };

  const handleDeptSelect = (dept) => {
    if (dept === null) {
      setSelectedDeptId("");
      setSelectedDeptName("All Departments");
    } else {
      setSelectedDeptId(String(dept.id));
      setSelectedDeptName(dept.name);
    }
  };

  if (inline) {
    return (
      <div className="flex flex-col">
        {/* Search & Filter */}
        <div className="px-4 sm:px-6 pb-3 space-y-2.5">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400/70 w-4 h-4 pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Search by name…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-11 bg-black/30 border border-white/5 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 focus:bg-black/50 text-white placeholder:text-white/30 rounded-xl px-4 py-3 pl-11 text-base sm:text-sm shadow-inner transition-all focus:outline-none"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-full min-h-11 bg-black/30 border border-white/5 rounded-xl px-4 py-2.5 flex justify-between items-center text-sm text-white/80 hover:bg-black/40 active:bg-black/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <span className="truncate">{selectedDeptName}</span>
                <ChevronDown className="ml-2 shrink-0 text-muted-foreground w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[280px] overflow-y-auto backdrop-blur-xl bg-gray-900/90 border border-white/10 rounded-xl shadow-xl p-1.5 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
              align="start"
            >
              <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground px-2 py-1">
                Filter by Department
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDeptSelect(null)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer text-white/90 hover:text-white focus:text-white hover:bg-white/10 focus:bg-white/10",
                  selectedDeptId === "" && "bg-white/10 font-medium"
                )}
              >
                {selectedDeptId === "" ? (
                  <Check size="13px" className="shrink-0" />
                ) : (
                  <span className="w-[13px] shrink-0" />
                )}
                All Departments
              </DropdownMenuItem>
              {departments.map((dept) => (
                <DropdownMenuItem
                  key={dept.id}
                  onClick={() => handleDeptSelect(dept)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer text-white/90 hover:text-white focus:text-white hover:bg-white/10 focus:bg-white/10",
                    selectedDeptId === String(dept.id) && "bg-white/10 font-medium"
                  )}
                >
                  {selectedDeptId === String(dept.id) ? (
                    <Check size="13px" className="shrink-0" />
                  ) : (
                    <span className="w-[13px] shrink-0" />
                  )}
                  {dept.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Results — scroll handled by parent panel overflow-y-auto */}
        <div className="px-4 sm:px-6 pb-6 space-y-3">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
              <p className="text-sm text-slate-400">Loading professors…</p>
            </div>
          )}
          {isError && (
            <p className="text-sm text-destructive text-center py-10">
              Failed to load professors. Please try again.
            </p>
          )}
          {!isLoading && !isError && displayedProfessors.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <GraduationCap size="32px" className="text-muted-foreground/40" />
              {isLiveModeActive ? (
                <p className="text-sm text-slate-400 text-center">
                  No professors currently in office
                </p>
              ) : (
                <>
                  <p className="text-sm text-slate-400">No professors found</p>
                  {(searchTerm || selectedDeptId) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm("");
                        setSelectedDeptId("");
                        setSelectedDeptName("All Departments");
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1 min-h-11 px-2"
                    >
                      Clear filters
                    </button>
                  )}
                </>
              )}
            </div>
          )}
          {displayedProfessors.map((prof) => (
            <ProfessorCard
              key={prof.id ?? prof.email}
              professor={prof}
              buildings={buildings}
              mapRef={mapRef}
              onHighlight={onHighlight}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "touch-target-inline min-h-11 gap-2 px-3 rounded-xl",
          "bg-secondary/80 text-foreground hover:bg-secondary/60 active:bg-secondary/50",
          "backdrop-blur-md shadow-lg border border-border/50",
          "transition-all duration-300 font-medium",
          "focus:outline-none focus:ring-2 focus:ring-secondary/50",
          className
        )}
        aria-label="Open professor directory"
      >
        <GraduationCap size="16px" className="shrink-0" />
        <span className="truncate">Professors</span>
      </button>

      {/* Slide-over Panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Professor Directory">
          {/* Backdrop */}
          <div
            className={cn(
              "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
              visible ? "opacity-100" : "opacity-0"
            )}
            onClick={handleClose}
          />

          {/* Panel */}
          <div
            className={cn(
              "absolute right-0 top-0 h-full w-full max-w-full sm:w-[min(100%,420px)] lg:w-[min(100%,480px)]",
              "bg-gray-900/90 backdrop-blur-xl border-l border-border/30",
              "flex flex-col shadow-2xl",
              "transition-transform duration-300 ease-in-out",
              visible ? "translate-x-0" : "translate-x-full"
            )}
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border/30 shrink-0 pt-[max(1rem,env(safe-area-inset-top))]">
              <div className="flex items-center gap-2">
                <GraduationCap size="18px" className="text-muted-foreground" />
                <h2 className="font-semibold text-foreground text-base">Professor Directory</h2>
                {displayedProfessors.length > 0 && !isLoading && (
                  <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
                    {displayedProfessors.length}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="rounded-full hover:bg-secondary/60 active:bg-secondary/50 border-none shrink-0"
                aria-label="Close professor directory"
              >
                <X size="16px" />
              </Button>
            </div>

            {/* Search & Filter */}
            <div className="px-4 sm:px-5 py-3 space-y-2.5 border-b border-border/30 shrink-0">
              {/* Search Input */}
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400/70 w-4 h-4 pointer-events-none"
                />
                <input
                  ref={searchInputRef}
                  type="search"
                  placeholder="Search by name…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full min-h-11 bg-black/30 border border-white/5 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 focus:bg-black/50 text-white placeholder:text-white/30 rounded-xl px-4 py-3 pl-11 text-base sm:text-sm shadow-inner transition-all focus:outline-none"
                />
              </div>

              {/* Department Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="w-full min-h-11 bg-black/30 border border-white/5 rounded-xl px-4 py-2.5 flex justify-between items-center text-sm text-white/80 hover:bg-black/40 active:bg-black/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <span className="truncate">{selectedDeptName}</span>
                    <ChevronDown className="ml-2 shrink-0 text-muted-foreground w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[280px] overflow-y-auto backdrop-blur-xl bg-gray-900/90 border border-white/10 rounded-xl shadow-xl p-1.5 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
                  align="start"
                >
                  <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground px-2 py-1">
                    Filter by Department
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDeptSelect(null)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer text-white/90 hover:text-white focus:text-white hover:bg-white/10 focus:bg-white/10",
                      selectedDeptId === "" && "bg-white/10 font-medium"
                    )}
                  >
                    {selectedDeptId === "" ? (
                      <Check size="13px" className="shrink-0" />
                    ) : (
                      <span className="w-[13px] shrink-0" />
                    )}
                    All Departments
                  </DropdownMenuItem>
                  {departments.map((dept) => (
                    <DropdownMenuItem
                      key={dept.id}
                      onClick={() => handleDeptSelect(dept)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer text-white/90 hover:text-white focus:text-white hover:bg-white/10 focus:bg-white/10",
                        selectedDeptId === String(dept.id) && "bg-white/10 font-medium"
                      )}
                    >
                      {selectedDeptId === String(dept.id) ? (
                        <Check size="13px" className="shrink-0" />
                      ) : (
                        <span className="w-[13px] shrink-0" />
                      )}
                      {dept.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Results List */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4 sm:p-4 space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {isLoading && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
                    <p className="text-sm text-muted-foreground">Loading professors…</p>
                  </div>
                )}
                {isError && (
                  <p className="text-sm text-destructive text-center py-10">
                    Failed to load professors. Please try again.
                  </p>
                )}
                {!isLoading && !isError && displayedProfessors.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <GraduationCap size="32px" className="text-muted-foreground/40" />
                    {isLiveModeActive ? (
                      <p className="text-sm text-muted-foreground text-center">
                        No professors currently in office
                      </p>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">No professors found</p>
                        {(searchTerm || selectedDeptId) && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchTerm("");
                              setSelectedDeptId("");
                              setSelectedDeptName("All Departments");
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1"
                          >
                            Clear filters
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
                {displayedProfessors.map((prof) => (
                  <ProfessorCard
                    key={prof.id ?? prof.email}
                    professor={prof}
                    buildings={buildings}
                    mapRef={mapRef}
                    onLocate={handleClose}
                    onHighlight={onHighlight}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </>
  );
}
