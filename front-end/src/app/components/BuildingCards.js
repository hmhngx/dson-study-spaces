import React, { useState, useEffect } from "react";
import { formatTime } from "../../../services/formatTime";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/tooltip";
import { ChevronDown, Star, Train } from "lucide-react";
import { Button } from "@/ui/button";
import Image from "next/image";
import { convertToIdFormat } from "../../../services/formatId";
import { checkIsOpenNow, cn } from "@/lib/utils";
import { useLiveTime } from "@/hooks/useLiveTime";

const BuildingCard = ({ building, day, coordinates, onClick, onError }) => {
  const { name, hours, distance, rating, station, image } = building;
  const [imageSrc, setImageSrc] = useState(image || "https://via.placeholder.com/150");
  const [imageError, setImageError] = useState(false);

  const now = useLiveTime();
  const isOpen = checkIsOpenNow(hours, now);

  useEffect(() => {
    if (!image) {
      console.warn(`No image provided for ${name}, using external placeholder`);
      setImageSrc("https://via.placeholder.com/150");
      setImageError(true);
    } else {
      setImageSrc(image);
      setImageError(false);
    }
  }, [image, name]);

  const todayHours = hours && hours[day] && Array.isArray(hours[day]) ? hours[day] : [];

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <article
      className={cn(
        "w-full flex flex-col gap-3 p-3 sm:p-4 rounded-2xl",
        "backdrop-blur-lg bg-gray-800/40 dark:bg-gray-900/50",
        "shadow-xl transition-all duration-300",
        "cursor-pointer border border-white/20 dark:border-white/15",
        "hover:bg-gray-800/50 dark:hover:bg-gray-900/60 hover:border-white/30 dark:hover:border-white/25",
        "active:scale-[0.99] md:hover:-translate-y-0.5",
        "text-left"
      )}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      id={convertToIdFormat(name)}
      tabIndex={0}
      role="button"
      aria-label={`View details for ${name || "building"}`}
    >
      <div className="h-32 sm:h-40 md:h-[150px] relative rounded-xl overflow-hidden shadow-lg">
        {imageError ? (
          <div className="h-full w-full flex items-center justify-center bg-gray-700/30 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border border-white/20 dark:border-white/15">
            <p className="text-sm text-gray-200 dark:text-gray-200 px-2 text-center">Image not available</p>
          </div>
        ) : (
          <Image
            src={imageSrc}
            alt={name || "Building"}
            fill={true}
            quality={75}
            sizes="(max-width: 640px) 100vw, 33vw"
            style={{ objectFit: "cover" }}
            className="rounded-xl transition-transform duration-300 md:hover:scale-105"
            onError={(e) => {
              console.error(`Failed to load image for ${name}: ${imageSrc}`);
              setImageSrc("https://via.placeholder.com/150");
              setImageError(true);
              if (onError) onError(e);
            }}
          />
        )}
      </div>

      <div className="flex justify-between items-start gap-2 mt-1 min-w-0">
        <h2 className="font-bold text-lg sm:text-xl tracking-tight text-white truncate flex-1">
          {name || "Unknown Building"}
        </h2>
        <div className="inline-flex gap-1 items-center text-sm font-medium shrink-0">
          <Star size="14px" fill="#FCD34D" strokeWidth={0} className="star-glow" />
          <span className="text-white">{rating != null ? rating.toFixed(1) : "N/A"}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 justify-between mt-1">
        {isOpen ? (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold tracking-wide uppercase shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
            Open
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold tracking-wide uppercase shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Closed
          </div>
        )}
        {todayHours.length === 2 && (
          <p className="text-xs text-white/50 truncate">Today: {todayHours[0]} – {todayHours[1]}</p>
        )}
      </div>

      <div className="text-sm font-medium inline-flex gap-2 items-center mt-1 min-w-0">
        <Train size="14px" strokeWidth={2} className="text-gray-300 shrink-0" />
        <span className="text-gray-200 truncate">{station || "N/A"} Station</span>
      </div>

      <div className="flex flex-wrap gap-2 items-center justify-between mt-2">
        <p className="text-base font-semibold text-white shrink-0">
          {coordinates && distance != null ? distance.toFixed(2) : "-"} km{" "}
          <span className="font-light text-sm text-gray-300">away</span>
        </p>

        <TooltipProvider>
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    className="
                      min-h-11 inline-flex gap-1 text-sm shrink-0
                      bg-gray-700/40 hover:bg-gray-700/50 active:bg-gray-700/60
                      transition-all duration-300 border border-white/30 
                      rounded-xl shadow-lg hover:shadow-xl
                      backdrop-blur-sm text-white
                    "
                    variant="ghost"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="sm:hidden">Hours</span>
                    <span className="hidden sm:inline">View Hours</span>
                    <ChevronDown size="14px" className="shrink-0" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>View building hours for all days</p>
              </TooltipContent>
            </Tooltip>
            <PopoverContent
              align="end"
              side="top"
              collisionPadding={16}
              className="
                bg-gray-800/40 dark:bg-gray-900/50 backdrop-blur-lg text-white 
                border border-white/20 dark:border-white/15 shadow-xl rounded-2xl
                p-4 max-h-[min(60vh,24rem)] overflow-y-auto
              "
            >
              <ul className="flex flex-col gap-2">
                {hours ? (
                  Object.entries(hours).map(([day_, times], i) => (
                    <li
                      key={i}
                      className={cn(
                        "flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-2 text-sm",
                        day === day_ ? "font-bold" : "font-medium"
                      )}
                    >
                      <span className="shrink-0">{day_}:</span>
                      <span className="text-white/90 sm:text-right">
                        {times && times.length > 0
                          ? `${formatTime(times[0])} - ${formatTime(times[1])}`
                          : "Closed"}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm">No hours available</li>
                )}
              </ul>
            </PopoverContent>
          </Popover>
        </TooltipProvider>
      </div>
    </article>
  );
};

export default BuildingCard;
