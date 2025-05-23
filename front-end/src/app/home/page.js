"use client";

import { useState, useEffect } from "react";
import { fetchAndSortBuildings } from "../../../services/distance";
import { ArrowDown, ListFilter, Github, Linkedin } from "lucide-react";
import { Button } from "@/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
      <div className="
        absolute bottom-0 left-0 h-full w-full sm:w-1/3 lg:w-1/4 
        bg-card/20 backdrop-blur-lg z-10 
        flex flex-col shadow-xl border-r border-border/30
      ">
        <div className="w-full py-6 px-6 flex flex-col gap-4">
          <Logo />
          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="
                bg-secondary/80 text-foreground hover:bg-secondary/60 
                backdrop-blur-md shadow-lg rounded-xl 
                transition-all duration-300 border-none
                font-semibold
                hover:shadow-xl focus:ring-2 focus:ring-secondary/50 focus:outline-none
              "
              as="a"
              href="https://github.com/hmhngx"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github size="14px" className="mr-2" /> GitHub
            </Button>
            <Button
              variant="ghost"
              className="
                bg-secondary/80 text-foreground hover:bg-secondary/60 
                backdrop-blur-md shadow-lg rounded-xl 
                transition-all duration-300 border-none
                font-semibold
                hover:shadow-xl focus:ring-2 focus:ring-secondary/50 focus:outline-none
              "
              as="a"
              href="https://www.linkedin.com/in/hmh-nguyen/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Linkedin size="14px" className="mr-2" /> LinkedIn
            </Button>
          </div>
          <AnimatedDateTime />
          <div className="flex gap-3">
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
                  "
                >
                  <ArrowDown size="14px" className="mr-2" /> {sortOption}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="
                  bg-card/20 backdrop-blur-md text-foreground 
                  border-none shadow-lg rounded-xl
                  p-2
                "
              >
                <DropdownMenuLabel className="font-bold">Sort By:</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setSortOption("Closest")}
                  disabled={!coordinates}
                  className="font-medium hover:bg-secondary/30 rounded-lg focus:bg-secondary/30 focus:outline-none"
                >
                  Closest
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSortOption("Furthest")}
                  disabled={!coordinates}
                  className="font-medium hover:bg-secondary/30 rounded-lg focus:bg-secondary/30 focus:outline-none"
                >
                  Furthest
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSortOption("Highest Rated")}
                  className="font-medium hover:bg-secondary/30 rounded-lg focus:bg-secondary/30 focus:outline-none"
                >
                  Highest Rated
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSortOption("Name")}
                  className="font-medium hover:bg-secondary/30 rounded-lg focus:bg-secondary/30 focus:outline-none"
                >
                  Name
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                  "
                >
                  <ListFilter size="14px" className="mr-2" /> {filterOption}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="
                  bg-card/20 backdrop-blur-md text-foreground 
                  border-none shadow-lg rounded-xl
                  p-2
                "
              >
                <DropdownMenuLabel className="font-bold">Filter By:</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setFilterOption("All")}
                  className="font-medium hover:bg-secondary/30 rounded-lg focus:bg-secondary/30 focus:outline-none"
                >
                  All
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setFilterOption("Open")}
                  className="font-medium hover:bg-secondary/30 rounded-lg focus:bg-secondary/30 focus:outline-none"
                >
                  Open
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setFilterOption("Closed")}
                  className="font-medium hover:bg-secondary/30 rounded-lg focus:bg-secondary/30 focus:outline-none"
                >
                  Closed
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <ScrollArea className="flex-grow overflow-y-auto">
          <div className="p-6 space-y-4">
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