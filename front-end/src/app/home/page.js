"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAndSortBuildings } from "../../../services/distance";
import { ArrowDown, ListFilter, Github, Linkedin, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  SortDropdownItem,
  FilterDropdownItem,
} from "@/ui/dropdown-menu";
import Map from "../components/Map";
import Loader from "../components/Loader";
import AnimatedDateTime from "../components/DateTime";
import { filterBuildings, sortBuildings } from "../../../services/operation";
import Logo from "../components/Logo";
import LazyBuildingCard from "../components/LazyBuildingCard";
import ProfessorSearch from "../components/ProfessorSearch";
import BuildingDirectory from "../components/BuildingDirectory";
import { convertToIdFormat } from "../../../services/formatId";
import { useActiveNowBuildingIds } from "@/hooks/useActiveNowBuildingIds";
import { useLiveTime } from "@/hooks/useLiveTime";
import { cn, getCampusDateParts } from "@/lib/utils";

const DEFAULT_COORDINATES = [40.2025, -77.1989];
const EMPTY_BUILDINGS = [];
const EMPTY_SET = new Set();

export default function Home() {
  const [coordinates, setCoordinates] = useState(null);
  const [day, setDay] = useState("");
  const [locationFetched, setLocationFetched] = useState(false);
  const [sortOption, setSortOption] = useState("Closest");
  const [filterOption, setFilterOption] = useState("All");
  const [selectedCoordinates, setSelectedCoordinates] = useState(null);
  const [error, setError] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState("spaces");
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [highlightedBuildingId, setHighlightedBuildingId] = useState(null);
  const [isLiveModeActive, setIsLiveModeActive] = useState(false);
  const [isTimeTravelActive, setIsTimeTravelActive] = useState(false);
  const [timeTravelHour, setTimeTravelHour] = useState(
    () => getCampusDateParts().hour
  );
  const [timeTravelDay, setTimeTravelDay] = useState(
    () => getCampusDateParts().dayName
  );
  const mapRef = useRef(null);
  const now = useLiveTime(60_000);

  const userCoords = coordinates ?? DEFAULT_COORDINATES;
  const {
    data: sortedBuildings = EMPTY_BUILDINGS,
    isLoading: buildingsLoading,
    isError: buildingsError,
    error: buildingsQueryError,
    refetch,
  } = useQuery({
    queryKey: ["buildings", userCoords[0], userCoords[1]],
    queryFn: async () => {
      const buildings = await fetchAndSortBuildings(userCoords[0], userCoords[1]);
      if (!Array.isArray(buildings)) {
        throw new Error("fetchAndSortBuildings did not return an array");
      }
      return buildings;
    },
    enabled: locationFetched,
  });

  const { data: liveModeActiveBuildingIds = EMPTY_SET } =
    useActiveNowBuildingIds(isLiveModeActive);

  const displayedBuildings = useMemo(
    () =>
      filterBuildings(
        sortBuildings(sortedBuildings, sortOption),
        filterOption,
        now
      ),
    [
      sortedBuildings,
      sortOption,
      filterOption,
      filterOption !== "All" ? now : null,
    ]
  );

  useEffect(() => {
    const getLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setCoordinates([latitude, longitude]);
            setLocationFetched(true);
          },
          (error) => {
            console.error("Geolocation error:", error.message);
            setCoordinates(DEFAULT_COORDINATES);
            setSortOption("Name");
            setLocationFetched(true);
            setError("Unable to fetch your location. Sorting by name instead.");
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else {
        console.warn("Geolocation not supported");
        setCoordinates(DEFAULT_COORDINATES);
        setSortOption("Name");
        setLocationFetched(true);
        setError("Geolocation not supported. Sorting by name instead.");
      }
    };
    getLocation();
  }, []);

  useEffect(() => {
    if (sortedBuildings.length > 0 && !day) {
      setDay(getCampusDateParts().dayName);
    }
  }, [sortedBuildings.length, day]);

  const loading = !locationFetched || buildingsLoading;
  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background flex justify-center items-center">
        <div className="flex flex-col gap-4 items-center justify-center">
          <Loader />
          <p className="font-medium text-lg text-foreground">Welcome to Dickinson Study Spaces</p>
        </div>
      </div>
    );
  }

  const displayError = error || (buildingsError ? "Failed to load building data: " + (buildingsQueryError?.message ?? "Unknown error") : null);
  if (displayError) {
    return (
      <div className="min-h-[100dvh] bg-background flex justify-center items-center">
        <div className="flex flex-col gap-4 items-center justify-center">
          <p className="font-medium text-lg text-red-500">{displayError}</p>
          <Button
            onClick={() => {
              setError(null);
              refetch();
            }}
            className="
              border-none
              bg-secondary/80 text-foreground hover:bg-secondary/60 
              backdrop-blur-md shadow-lg rounded-xl 
              transition-all duration-300
              font-semibold
              hover:shadow-xl focus:ring-2 focus:ring-secondary/50 focus:outline-none
            "
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const panelBase =
    "isolate w-full shrink-0 flex flex-col min-h-0 z-20 transition-all duration-300 ease-in-out bg-slate-950/60 supports-[backdrop-filter]:bg-slate-950/60 backdrop-blur-2xl supports-[backdrop-filter]:backdrop-blur-2xl border-t border-r-0 md:border-t-0 md:border-r border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] text-slate-100";
  const panelSizeClasses = sidebarCollapsed
    ? "h-auto max-h-[4.5rem] md:h-full md:max-h-none md:w-16"
    : "h-[min(55dvh,28rem)] md:h-full md:max-h-none md:w-[min(100%,20rem)] lg:w-1/4";

  return (
    <main className="flex flex-col md:flex-row-reverse h-[100dvh] w-full overflow-hidden text-foreground">
      {/* Map region */}
      <div className="flex-1 relative min-h-[40dvh] md:min-h-0 min-w-0 backdrop-blur-sm backdrop-brightness-75">
        <Map
          ref={mapRef}
          data={displayedBuildings}
          className="absolute inset-0 h-full w-full"
          coordinates={coordinates}
          selectedCoordinates={selectedCoordinates}
          highlightedBuildingId={highlightedBuildingId}
          isLiveModeActive={isLiveModeActive}
          liveModeActiveBuildingIds={liveModeActiveBuildingIds}
          activeView={activeView}
          isTimeTravelActive={isTimeTravelActive}
          timeTravelHour={timeTravelHour}
          timeTravelDay={timeTravelDay}
          onBuildingClick={(building) => {
            setSelectedBuilding(building);
            setSidebarCollapsed(false);
          }}
        />

        <TooltipProvider>
        {/* Time Travel — bottom-center of map region */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-auto flex flex-col items-center gap-3 pb-[env(safe-area-inset-bottom)] w-[min(100%,24rem)] max-w-[calc(100vw-1rem)] px-1 box-border">
          <Tooltip>
            <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setIsTimeTravelActive((prev) => !prev)}
            aria-label="Toggle Time Travel"
            aria-pressed={isTimeTravelActive}
            className={`
              touch-target-inline min-h-11 rounded-full
              backdrop-blur-md shadow-lg border
              transition-all duration-300
              max-w-full
              ${isTimeTravelActive
                ? "bg-violet-950/70 border-violet-500/40 shadow-[0_0_20px_rgba(167,139,250,0.18)]"
                : "bg-black/60 border-white/10 hover:bg-black/70"
              }
            `}
          >
            <Clock
              size={14}
              className={`shrink-0 transition-colors duration-300 ${
                isTimeTravelActive ? "text-violet-300" : "text-white/50"
              }`}
            />
            <span
              className={`text-sm font-semibold transition-colors duration-300 ${
                isTimeTravelActive ? "text-violet-300" : "text-white/60"
              }`}
            >
              Time Travel
            </span>
            <div
              className={`relative ml-1 w-9 h-5 rounded-full transition-colors duration-300 ${
                isTimeTravelActive ? "bg-violet-500" : "bg-white/20"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${
                  isTimeTravelActive ? "left-[18px]" : "left-0.5"
                }`}
              />
            </div>
          </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px]">
              <p>
                {isTimeTravelActive
                  ? "Preview which study spaces are open at the day and time below."
                  : "See which study spaces would be open on a chosen day and hour."}
              </p>
            </TooltipContent>
          </Tooltip>

          {isTimeTravelActive && (
            <div className="w-full min-w-0 box-border flex flex-col gap-4 px-4 sm:px-6 py-4 rounded-2xl bg-black/65 backdrop-blur-md border border-white/10 shadow-2xl">
              {/* Day selector */}
              <div className="flex items-center gap-2 sm:gap-3 w-full min-w-0">
                <span className="text-xs font-medium text-white/50 w-8 shrink-0">Day</span>
                <div className="flex-1 min-w-0">
                  <select
                    value={timeTravelDay}
                    onChange={(e) => setTimeTravelDay(e.target.value)}
                    aria-label="Day of week for time travel"
                    title="Pick the day of the week to preview hours"
                    className="w-full max-w-full min-h-11 bg-white/10 text-white text-sm font-medium rounded-lg px-3 py-2.5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-violet-500/50 cursor-pointer truncate"
                  >
                    {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((d) => (
                      <option key={d} value={d} className="bg-gray-900 text-white">{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Hour slider */}
              <div className="flex flex-col gap-2 w-full min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-white/50 shrink-0">Hour</span>
                  <span className="text-sm font-bold text-violet-300 tabular-nums shrink-0">
                    {timeTravelHour === 0
                      ? "12:00 AM"
                      : timeTravelHour < 12
                      ? `${timeTravelHour}:00 AM`
                      : timeTravelHour === 12
                      ? "12:00 PM"
                      : `${timeTravelHour - 12}:00 PM`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={23}
                  step={1}
                  value={timeTravelHour}
                  onChange={(e) => setTimeTravelHour(Number(e.target.value))}
                  aria-label="Hour for time travel preview"
                  title="Drag to see open vs. closed buildings at that hour"
                  className="touch-range w-full max-w-full"
                  style={{
                    background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${(timeTravelHour / 23) * 100}%, rgba(255,255,255,0.15) ${(timeTravelHour / 23) * 100}%, rgba(255,255,255,0.15) 100%)`,
                  }}
                />
                <div className="grid grid-cols-5 w-full gap-1 text-[9px] sm:text-[10px] text-white/30 font-medium leading-tight">
                  <span className="text-left whitespace-nowrap">12 AM</span>
                  <span className="text-center whitespace-nowrap">6 AM</span>
                  <span className="text-center whitespace-nowrap">12 PM</span>
                  <span className="text-center whitespace-nowrap">6 PM</span>
                  <span className="text-right whitespace-nowrap">11 PM</span>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-white/50 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Open
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-gray-500 inline-block" /> Closed
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Live Mode — top-center of map region */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-auto pt-[env(safe-area-inset-top)] max-w-[calc(100%-1rem)]">
          <Tooltip>
            <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setIsLiveModeActive((prev) => !prev)}
            aria-label="Toggle Live Mode"
            aria-pressed={isLiveModeActive}
            className={`
              flex items-center gap-2.5 px-4 py-2 rounded-full
              backdrop-blur-md shadow-lg border
              transition-all duration-300 whitespace-nowrap
              ${isLiveModeActive
                ? "bg-green-950/70 border-green-500/40 shadow-[0_0_20px_rgba(74,222,128,0.18)]"
                : "bg-black/60 border-white/10 hover:bg-black/70"
              }
            `}
          >
            <span
              className={`
                w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-300
                ${isLiveModeActive
                  ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.9)] animate-pulse"
                  : "bg-gray-500"
                }
              `}
            />
            <span
              className={`text-sm font-semibold transition-colors duration-300 ${
                isLiveModeActive ? "text-green-300" : "text-white/60"
              }`}
            >
              <span className="hidden min-[380px]:inline">Live: In Office Now</span>
              <span className="min-[380px]:hidden">Live</span>
            </span>
            {/* Pill toggle switch */}
            <div
              className={`relative ml-1 w-9 h-5 rounded-full transition-colors duration-300 ${
                isLiveModeActive ? "bg-green-500" : "bg-white/20"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${
                  isLiveModeActive ? "left-[18px]" : "left-0.5"
                }`}
              />
            </div>
          </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[260px]">
              <p>
                {isLiveModeActive
                  ? "Showing buildings where professors are in office now. Updates every minute."
                  : "Highlight buildings with professors in office right now."}
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
        </TooltipProvider>
      </div>

      {/* Panel region */}
      <aside className={cn(panelBase, panelSizeClasses)}>
        <div className="shrink-0 flex justify-end p-1.5 md:p-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  variant="ghost"
                  size="icon"
                  className="
                    panel-glass-control text-slate-100 shadow-lg rounded-full
                    transition-all duration-300
                    hover:shadow-xl focus:ring-2 focus:ring-white/20 focus:outline-none
                  "
                  aria-label={sidebarCollapsed ? "Expand panel" : "Collapse panel"}
                >
                  {sidebarCollapsed ? (
                    <ChevronRight size="16px" />
                  ) : (
                    <ChevronLeft size="16px" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {!sidebarCollapsed && selectedBuilding ? (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <BuildingDirectory
              buildingId={selectedBuilding.id}
              building={selectedBuilding}
              onBack={() => setSelectedBuilding(null)}
              buildings={sortedBuildings}
              mapRef={mapRef}
            />
          </div>
        ) : (
          <>
            <div
              className={cn(
                "w-full shrink-0 flex flex-col gap-2 md:gap-4 transition-all duration-300 px-4 md:px-6 py-2 md:py-4",
                sidebarCollapsed ? "max-md:hidden md:opacity-0 md:pointer-events-none md:overflow-hidden" : "opacity-100"
              )}
            >
              <Logo />
            </div>

            <div
              className={cn(
                "hidden md:flex flex-col gap-4 shrink-0 px-4 md:px-6 pb-2 transition-all duration-300",
                sidebarCollapsed ? "md:opacity-0 md:pointer-events-none md:overflow-hidden md:h-0 md:pb-0" : ""
              )}
            >
              <div className="flex gap-4 flex-row">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        className="
                          panel-glass-control text-slate-100 shadow-lg rounded-xl
                          transition-all duration-300 font-semibold
                          hover:shadow-xl focus:ring-2 focus:ring-white/20 focus:outline-none
                        "
                        as="a"
                        href="https://github.com/hmhngx"
                        target="_blank"
                        rel="noopener noreferrer"
                        title="GitHub"
                      >
                        <Github size="14px" className="mr-2" />
                        GitHub
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Visit GitHub profile</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        className="
                          panel-glass-control text-slate-100 shadow-lg rounded-xl
                          transition-all duration-300 font-semibold
                          hover:shadow-xl focus:ring-2 focus:ring-white/20 focus:outline-none
                        "
                        as="a"
                        href="https://www.linkedin.com/in/hmh-nguyen/"
                        target="_blank"
                        rel="noopener noreferrer"
                        title="LinkedIn"
                      >
                        <Linkedin size="14px" className="mr-2" />
                        LinkedIn
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Visit LinkedIn profile</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {!sidebarCollapsed && <AnimatedDateTime />}
            </div>

            {/* Segmented control — visible when expanded, or in mobile collapsed strip */}
            <div
              className={cn(
                "shrink-0 px-4 pt-1 pb-1 md:px-6 md:pt-0 md:pb-2",
                sidebarCollapsed ? "md:hidden" : ""
              )}
            >
              <div className="flex p-1 bg-white/5 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveView("spaces")}
                  className={`flex-1 min-h-11 py-2.5 text-sm font-medium transition-all duration-200 rounded-lg ${
                    activeView === "spaces"
                      ? "bg-white/[0.15] text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)] border border-white/10"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  Study Spaces
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView("faculty")}
                  className={`flex-1 min-h-11 py-2.5 text-sm font-medium transition-all duration-200 rounded-lg ${
                    activeView === "faculty"
                      ? "bg-white/[0.15] text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)] border border-white/10"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  Faculty
                </button>
              </div>
            </div>

            {!sidebarCollapsed && (
              <div className="shrink-0 px-4 md:px-6 pb-2 md:pb-4">
              {activeView === "spaces" && (
                <TooltipProvider>
                  <div className="flex flex-row flex-nowrap items-stretch gap-2 w-full transition-all duration-300">
                    <div className="flex-1 min-w-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                className="
                                  panel-glass-control text-slate-100 shadow-lg rounded-xl
                                  transition-all duration-300 font-semibold
                                  hover:shadow-xl focus:ring-2 focus:ring-white/20 focus:outline-none
                                  w-full min-w-0 justify-between
                                "
                              >
                                <ArrowDown size="14px" className="mr-2 shrink-0" />
                                <span className="truncate">{sortOption}</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="start"
                              className="bg-popover text-popover-foreground border shadow-xl rounded-xl p-2"
                            >
                              <DropdownMenuLabel className="font-bold text-foreground">Sort By:</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <SortDropdownItem sortType="Closest" isActive={sortOption === "Closest"} onClick={() => setSortOption("Closest")} disabled={!coordinates} />
                              <SortDropdownItem sortType="Furthest" isActive={sortOption === "Furthest"} onClick={() => setSortOption("Furthest")} disabled={!coordinates} />
                              <SortDropdownItem sortType="Highest Rated" isActive={sortOption === "Highest Rated"} onClick={() => setSortOption("Highest Rated")} />
                              <SortDropdownItem sortType="Name" isActive={sortOption === "Name"} onClick={() => setSortOption("Name")} />
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Sort buildings by different criteria</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex-1 min-w-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                className="
                                  panel-glass-control text-slate-100 shadow-lg rounded-xl
                                  transition-all duration-300 font-semibold
                                  hover:shadow-xl focus:ring-2 focus:ring-white/20 focus:outline-none
                                  w-full min-w-0 justify-between
                                "
                              >
                                <ListFilter size="14px" className="mr-2 shrink-0" />
                                <span className="truncate">{filterOption}</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="start"
                              className="bg-popover text-popover-foreground border shadow-xl rounded-xl p-2"
                            >
                              <DropdownMenuLabel className="font-bold text-foreground">Filter By:</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <FilterDropdownItem filterType="All" isActive={filterOption === "All"} onClick={() => setFilterOption("All")} />
                              <FilterDropdownItem filterType="Open" isActive={filterOption === "Open"} onClick={() => setFilterOption("Open")} />
                              <FilterDropdownItem filterType="Closed" isActive={filterOption === "Closed"} onClick={() => setFilterOption("Closed")} />
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Filter buildings by status</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </TooltipProvider>
              )}
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto">
              {!sidebarCollapsed && activeView === "spaces" && (
                <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                  {displayedBuildings.length > 0 ? (
                    displayedBuildings.map((building) => (
                      <LazyBuildingCard
                        key={building.id ?? convertToIdFormat(building.name)}
                        building={building}
                        coordinates={coordinates}
                        id={convertToIdFormat(building.name)}
                        day={day}
                        onClick={() => {
                          setSelectedBuilding(building);
                          setSelectedCoordinates(null);
                          setTimeout(() => setSelectedCoordinates(building.coords), 0);
                        }}
                      />
                    ))
                  ) : (
                    <p className="text-center text-slate-400 font-medium">
                      No buildings available.
                    </p>
                  )}
                </div>
              )}

              {!sidebarCollapsed && activeView === "faculty" && (
                <ProfessorSearch
                  inline
                  mapRef={mapRef}
                  buildings={sortedBuildings}
                  onHighlight={setHighlightedBuildingId}
                  isLiveModeActive={isLiveModeActive}
                />
              )}
            </div>
          </>
        )}
      </aside>
    </main>
  );
}

export const dynamic = "force-dynamic";