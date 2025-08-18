import React, { useState, useEffect } from "react";
import { formatTime } from "../../../services/formatTime";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import { ChevronDown, Clock, Star, Train } from "lucide-react";
import { Button } from "@/ui/button";
import Image from "next/image";
import { convertToIdFormat } from "../../../services/formatId";

const BuildingCard = ({ building, day, coordinates, onClick, onError }) => {
  const { name, hours, distance, status, rating, station, image } = building;
  const [imageSrc, setImageSrc] = useState(image || "https://via.placeholder.com/150");
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    console.log(`BuildingCard for ${name}: image prop =`, image);
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

  return (
    <div
      className={`
        flex flex-col gap-3 p-4 rounded-2xl mr-4 
        backdrop-blur-lg bg-gray-800/40 dark:bg-gray-900/50
        shadow-xl hover:shadow-2xl 
        transition-all duration-300 
        cursor-pointer border border-white/20 dark:border-white/15
        hover:bg-gray-800/50 dark:hover:bg-gray-900/60 hover:border-white/30 dark:hover:border-white/25
        transform hover:-translate-y-1`
      }
      onClick={onClick}
      id={convertToIdFormat(name)}
      tabIndex={0}
    >
      <div className="h-[150px] relative rounded-xl overflow-hidden shadow-lg">
        {imageError ? (
          <div className="h-full w-full flex items-center justify-center bg-gray-700/30 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border border-white/20 dark:border-white/15">
            <p className="text-sm text-gray-200 dark:text-gray-200">Image not available</p>
          </div>
        ) : (
          <Image
            src={imageSrc}
            alt={name || "Building"}
            fill={true}
            quality={75}
            style={{ objectFit: "cover" }}
            className="rounded-xl transition-transform duration-300 hover:scale-105"
            onError={(e) => {
              console.error(`Failed to load image for ${name}: ${imageSrc}`);
              setImageSrc("https://via.placeholder.com/150");
              setImageError(true);
              if (onError) onError(e);
            }}
          />
        )}
      </div>

              <div className="flex justify-between items-center mt-2">
          <h2 className="font-bold text-xl tracking-tight text-white">{name || "Unknown Building"}</h2>
          <div className="inline-flex gap-1 items-center text-sm font-medium">
            <Star size="14px" fill="#FCD34D" strokeWidth={0} className="star-glow" />
            <span className="text-white">{rating != null ? rating.toFixed(1) : "N/A"}</span>
          </div>
        </div>

      <div className="text-sm inline-flex gap-2 items-center mt-1">
        <Clock size="14px" strokeWidth={2} className="text-gray-300" />
        <div className="inline-flex gap-1 items-center">
          {status === "Open" ? (
            <p className="text-emerald-400 font-semibold">
              Open{todayHours[1] && todayHours[1] !== "00:00" ? ` until ${formatTime(todayHours[1])}` : ""}
            </p>
          ) : (
            <p className="text-red-400 font-semibold">
              Closed{todayHours.length > 0 ? "" : " today"}
            </p>
          )}
        </div>
      </div>

      <div className="text-sm font-medium inline-flex gap-2 items-center mt-1">
        <Train size="14px" strokeWidth={2} className="text-gray-300" />
        <span className="text-gray-200">{station || "N/A"} Station</span>
      </div>

      <div className="inline-flex gap-2 items-center justify-between mt-2">
        <p className="text-base font-semibold text-white">
          {coordinates && distance != null ? distance.toFixed(2) : "-"} km{" "}
          <span className="font-light text-sm text-gray-300">away</span>
        </p>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              className="
                inline-flex gap-1 text-sm 
                bg-gray-700/40 hover:bg-gray-700/50 
                transition-all duration-300 border border-white/30 
                rounded-xl shadow-lg hover:shadow-xl
                backdrop-blur-sm text-white
              "
              variant="ghost"
              onClick={(e) => e.stopPropagation()}
            >
              View Hours <ChevronDown size="14px" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="
              bg-gray-800/40 dark:bg-gray-900/50 backdrop-blur-lg text-white 
              border border-white/20 dark:border-white/15 shadow-xl rounded-2xl
              p-4
            "
          >
            <ul className="flex flex-col gap-2">
              {hours ? (
                Object.entries(hours).map(([day_, times], i) => (
                  <li
                    key={i}
                    className={`flex justify-between text-sm ${day === day_ ? "font-bold" : "font-medium"}`}
                  >
                    <span>{day_}:</span>
                    <div>
                      {times && times.length > 0
                        ? `${formatTime(times[0])} - ${formatTime(times[1])}`
                        : "Closed"}
                    </div>
                  </li>
                ))
              ) : (
                <li className="text-sm">No hours available</li>
              )}
            </ul>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

export default BuildingCard;