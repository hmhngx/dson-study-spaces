"use client";

import { useState, useEffect } from "react";
import { fetchAndSortBuildings } from "../../../services/distance";
import { ArrowDown, ListFilter, Github, Linkedin, ChevronLeft, ChevronRight } from "lucide-react";
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
import { ScrollArea } from "@/ui/scroll-area";
import Map from "../components/Map";
import Loader from "../components/Loader";
import AnimatedDateTime from "../components/DateTime";
import { filterBuildings, sortBuildings } from "../../../services/operation";
import Logo from "../components/Logo";
import LazyBuildingCard from "../components/LazyBuildingCard";
import { convertToIdFormat } from "../../../services/formatId";

export default function Home() {
  const DEFAULT_COORDINATES = [40.2025, -77.1989];
  const [coordinates, setCoordinates] = useState(null);
  const [sortedBuildings, setSortedBuildings] = useState([]);
  const [day, setDay] = useState("");
  const [loading, setLoading] = useState(true);
  const [locationFetched, setLocationFetched] = useState(false);
  const [sortOption, setSortOption] = useState("Closest");
  const [filterOption, setFilterOption] = useState("All");
  const [displayedBuildings, setDisplayedBuildings] = useState([]);
  const [selectedCoordinates, setSelectedCoordinates] = useState(null);
  const [error, setError] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    console.log(`Sorting buildings with option: ${sortOption}`);
    console.log(`Filtering buildings with option: ${filterOption}`);
    console.log("Buildings before sorting and filtering:", sortedBuildings);
    const updatedBuildings = filterBuildings(
      sortBuildings(sortedBuildings, sortOption),
      filterOption
    );
    console.log("Buildings after sorting and filtering:", updatedBuildings);
    setDisplayedBuildings(updatedBuildings);
  }, [sortOption, filterOption, sortedBuildings]);

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
          }
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
    const fetchData = async () => {
      try {
        const userCoords = coordinates || DEFAULT_COORDINATES;
        const buildings = await fetchAndSortBuildings(userCoords[0], userCoords[1]);
        if (!Array.isArray(buildings)) {
          throw new Error("fetchAndSortBuildings did not return an array");
        }
        console.log("Fetched buildings:", buildings);

        setSortedBuildings(buildings);
        setDisplayedBuildings(buildings);
        const current = new Date();
        setDay(current.toLocaleString("en-US", { weekday: "long" }));
      } catch (error) {
        console.error("Error fetching buildings:", error.message);
        setError("Failed to load building data: " + error.message);
        setSortedBuildings([]);
        setDisplayedBuildings([]);
      } finally {
        setLoading(false);
      }
    };

    if (locationFetched) {
      fetchData();
    }
  }, [coordinates, locationFetched]);

  if (loading || !locationFetched) {
    return (
      <div className="min-h-screen bg-background flex justify-center items-center">
        <div className="flex flex-col gap-4 items-center justify-center">
          <Loader />
          <p className="font-medium text-lg text-foreground">Welcome to Dickinson Study Spaces</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex justify-center items-center">
        <div className="flex flex-col gap-4 items-center justify-center">
          <p className="font-medium text-lg text-red-500">{error}</p>
          <Button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchData();
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

  return (
    <main className="relative h-screen text-foreground">
      <div className="absolute inset-0 w-full h-full backdrop-blur-sm backdrop-brightness-75">
        <Map
          data={displayedBuildings}
          className="absolute inset-0 w-full h-full"
          coordinates={coordinates}
          selectedCoordinates={selectedCoordinates}
        />
      </div>
      <div className={`
        absolute bottom-0 left-0 h-full z-10 
        bg-gray-900/60 backdrop-blur-lg 
        flex flex-col shadow-xl border-r border-border/30
        transition-all duration-300 ease-in-out
        ${sidebarCollapsed 
          ? 'w-16 sm:w-16 lg:w-16' 
          : 'w-full sm:w-1/3 lg:w-1/4'
        }
      `}>
        {/* Toggle Button */}
        <div className="absolute top-4 right-4 z-20">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  variant="ghost"
                  size="sm"
                  className="
                    bg-secondary/80 text-foreground hover:bg-secondary/60 
                    backdrop-blur-md shadow-lg rounded-full 
                    transition-all duration-300 border-none
                    hover:shadow-xl focus:ring-2 focus:ring-secondary/50 focus:outline-none
                    w-8 h-8 p-0
                  "
                  aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
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

        <div className={`w-full py-8 px-6 flex flex-col gap-6 transition-all duration-300 ${
          sidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}>
          <Logo />
          <div className={`flex gap-4 transition-all duration-300 ${
            sidebarCollapsed ? 'flex-col' : 'flex-row'
          }`}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    className={`
                      bg-secondary/80 text-foreground hover:bg-secondary/60 
                      backdrop-blur-md shadow-lg rounded-xl 
                      transition-all duration-300 border-none
                      font-semibold
                      hover:shadow-xl focus:ring-2 focus:ring-secondary/50 focus:outline-none
                      ${sidebarCollapsed ? 'w-10 h-10 p-0' : ''}
                    `}
                    as="a"
                    href="https://github.com/hmhngx"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="GitHub"
                  >
                    <Github size="14px" className={sidebarCollapsed ? '' : 'mr-2'} />
                    {!sidebarCollapsed && 'GitHub'}
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
                    className={`
                      bg-secondary/80 text-foreground hover:bg-secondary/60 
                      backdrop-blur-md shadow-lg rounded-xl 
                      transition-all duration-300 border-none
                      font-semibold
                      hover:shadow-xl focus:ring-2 focus:ring-secondary/50 focus:outline-none
                      ${sidebarCollapsed ? 'w-10 h-10 p-0' : ''}
                    `}
                    as="a"
                    href="https://www.linkedin.com/in/hmh-nguyen/"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="LinkedIn"
                  >
                    <Linkedin size="14px" className={sidebarCollapsed ? '' : 'mr-2'} />
                    {!sidebarCollapsed && 'LinkedIn'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Visit LinkedIn profile</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {!sidebarCollapsed && <AnimatedDateTime />}
          <div className={`flex gap-4 transition-all duration-300 ${
            sidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="
                          bg-secondary/80 text-foreground hover:bg-secondary/60 
                          backdrop-blur-md shadow-lg rounded-xl 
                          transition-all duration-300 border-none
                          font-semibold
                          hover:shadow-xl focus:ring-2 focus:ring-secondary/50 focus:outline-none
                          min-w-[140px] justify-between
                        "
                      >
                        <ArrowDown size="14px" className="mr-2" /> {sortOption}
                      </Button>
                    </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="
                  bg-popover text-popover-foreground 
                  border shadow-xl rounded-xl
                  p-2
                "
              >
                <DropdownMenuLabel className="font-bold text-foreground">Sort By:</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <SortDropdownItem
                  sortType="Closest"
                  isActive={sortOption === "Closest"}
                  onClick={() => setSortOption("Closest")}
                  disabled={!coordinates}
                />
                <SortDropdownItem
                  sortType="Furthest"
                  isActive={sortOption === "Furthest"}
                  onClick={() => setSortOption("Furthest")}
                  disabled={!coordinates}
                />
                <SortDropdownItem
                  sortType="Highest Rated"
                  isActive={sortOption === "Highest Rated"}
                  onClick={() => setSortOption("Highest Rated")}
                />
                <SortDropdownItem
                  sortType="Name"
                  isActive={sortOption === "Name"}
                  onClick={() => setSortOption("Name")}
                />
              </DropdownMenuContent>
                    </DropdownMenu>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sort buildings by different criteria</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="
                          bg-secondary/80 text-foreground hover:bg-secondary/60 
                          backdrop-blur-md shadow-lg rounded-xl 
                          transition-all duration-300 border-none
                          font-semibold
                          hover:shadow-xl focus:ring-2 focus:ring-secondary/50 focus:outline-none
                          min-w-[140px] justify-between
                        "
                      >
                        <ListFilter size="14px" className="mr-2" /> {filterOption}
                      </Button>
                    </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="
                  bg-popover text-popover-foreground 
                  border shadow-xl rounded-xl
                  p-2
                "
              >
                <DropdownMenuLabel className="font-bold text-foreground">Filter By:</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <FilterDropdownItem
                  filterType="All"
                  isActive={filterOption === "All"}
                  onClick={() => setFilterOption("All")}
                />
                <FilterDropdownItem
                  filterType="Open"
                  isActive={filterOption === "Open"}
                  onClick={() => setFilterOption("Open")}
                />
                <FilterDropdownItem
                  filterType="Closed"
                  isActive={filterOption === "Closed"}
                  onClick={() => setFilterOption("Closed")}
                />
              </DropdownMenuContent>
                    </DropdownMenu>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Filter buildings by status</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <ScrollArea className={`flex-grow overflow-y-auto transition-all duration-300 ${
          sidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}>
          <div className="p-6 space-y-6">
            {displayedBuildings.length > 0 ? (
              displayedBuildings.map((building) => (
                <LazyBuildingCard
                  building={building}
                  coordinates={coordinates}
                  key={building.name}
                  id={convertToIdFormat(building.name)}
                  day={day}
                  onClick={() => {
                    setSelectedCoordinates(null);
                    setTimeout(() => setSelectedCoordinates(building.coords), 0);
                  }}
                />
              ))
            ) : (
              <p className="text-center text-muted-foreground font-medium">
                No buildings available.
              </p>
            )}
          </div>
        </ScrollArea>
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";