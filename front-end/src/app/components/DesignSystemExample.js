import React, { useState } from "react";
import { Button } from "@/ui/button";
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
import {
  ChevronDown,
  ArrowDown,
  ListFilter,
  MapPin,
  Star,
  Clock,
  Train,
} from "lucide-react";
import Image from "next/image";

const DesignSystemExample = () => {
  const [sortOption, setSortOption] = useState("Closest");
  const [filterOption, setFilterOption] = useState("All");

  // Mock building data for demonstration
  const mockBuildings = [
    {
      name: "Althouse Hall",
      rating: 4.8,
      status: "Open",
      distance: 0.3,
      station: "Central",
      image: "/images/althouse.jpg",
      hours: { "Monday": ["08:00", "22:00"] }
    },
    {
      name: "Bosler Memorial Library",
      rating: 4.9,
      status: "Open",
      distance: 0.5,
      station: "North",
      image: "/images/bosler.jpg",
      hours: { "Monday": ["07:00", "23:00"] }
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground font-heading">
            Design System Showcase
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Demonstrating the new design system with solid dropdowns for utility and 
            glassmorphic cards for content presentation.
          </p>
        </div>

        {/* Controls Section - Solid Backgrounds */}
        <div className="bg-card/80 backdrop-blur-md rounded-2xl p-6 border border-border/50 shadow-xl">
          <h2 className="text-2xl font-bold text-foreground mb-6 font-heading">
            Utility Controls (Solid Backgrounds)
          </h2>
          <p className="text-muted-foreground mb-6">
            Dropdowns use solid backgrounds for maximum readability and accessibility. 
            Perfect for utility functions and settings.
          </p>
          
          <div className="flex gap-4 flex-wrap">
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
                    min-w-[160px] justify-between
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
                />
                <SortDropdownItem
                  sortType="Furthest"
                  isActive={sortOption === "Furthest"}
                  onClick={() => setSortOption("Furthest")}
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
                    min-w-[160px] justify-between
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
          </div>
        </div>

        {/* Content Section - Glassmorphic Cards */}
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4 font-heading">
              Content Presentation (Glassmorphic Cards)
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Building cards use glassmorphism for a modern, polished look with 
              semi-transparent backgrounds and subtle blur effects.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockBuildings.map((building, index) => (
              <div
                key={building.name}
                className={`
                  flex flex-col gap-3 p-4 rounded-2xl
                  backdrop-blur-lg bg-gray-800/40 dark:bg-gray-900/50
                  shadow-xl hover:shadow-2xl 
                  transition-all duration-300 
                  cursor-pointer border border-white/20 dark:border-white/15
                  hover:bg-gray-800/50 dark:hover:bg-gray-900/60 hover:border-white/30 dark:hover:border-white/25
                  transform hover:-translate-y-1
                `}
              >
                {/* Image Container */}
                                 <div className="h-[150px] relative rounded-xl overflow-hidden shadow-lg">
                   <div className="h-full w-full flex items-center justify-center bg-gray-700/30 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border border-white/20 dark:border-white/15">
                     <div className="text-center space-y-2">
                       <div className="w-12 h-12 bg-white/30 rounded-full flex items-center justify-center mx-auto">
                         <MapPin className="h-6 w-6 text-white" />
                       </div>
                       <p className="text-sm text-white font-medium">{building.name}</p>
                     </div>
                   </div>
                 </div>

                {/* Building Info */}
                                 <div className="flex justify-between items-center mt-2">
                   <h3 className="font-bold text-xl tracking-tight text-white">{building.name}</h3>
                   <div className="inline-flex gap-1 items-center text-sm font-medium">
                     <Star size="14px" fill="#FCD34D" strokeWidth={0} className="star-glow" />
                     <span className="text-white">{building.rating.toFixed(1)}</span>
                   </div>
                 </div>

                {/* Status */}
                <div className="text-sm inline-flex gap-2 items-center mt-1">
                  <Clock size="14px" strokeWidth={2} className="text-gray-300" />
                  <div className="inline-flex gap-1 items-center">
                    {building.status === "Open" ? (
                      <p className="text-emerald-400 font-semibold">
                        Open until 22:00
                      </p>
                    ) : (
                      <p className="text-red-400 font-semibold">
                        Closed today
                      </p>
                    )}
                  </div>
                </div>

                {/* Station */}
                <div className="text-sm font-medium inline-flex gap-2 items-center mt-1">
                  <Train size="14px" strokeWidth={2} className="text-gray-300" />
                  <span className="text-gray-200">{building.station} Station</span>
                </div>

                {/* Distance and Action */}
                <div className="inline-flex gap-2 items-center justify-between mt-2">
                  <p className="text-base font-semibold text-white">
                    {building.distance.toFixed(2)} km{" "}
                    <span className="font-light text-sm text-gray-300">away</span>
                  </p>

                  <Button
                    className="
                      inline-flex gap-1 text-sm 
                      bg-gray-700/40 hover:bg-gray-700/50 
                      transition-all duration-300 border border-white/30 
                      rounded-xl shadow-lg hover:shadow-xl
                      backdrop-blur-sm text-white
                    "
                    variant="ghost"
                  >
                    View Hours <ChevronDown size="14px" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Design Principles */}
        <div className="bg-card/80 backdrop-blur-md rounded-2xl p-6 border border-border/50 shadow-xl">
          <h2 className="text-2xl font-bold text-foreground mb-6 font-heading">
            Design Principles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Utility Components (Solid)</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>Dropdown menus and controls</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>Settings panels and forms</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>Navigation elements</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>Maximum readability and accessibility</span>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Content Components (Glassmorphic)</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>Building and content cards</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>Profile and information panels</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>Feature showcases and highlights</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>Modern, polished visual appeal</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesignSystemExample;
