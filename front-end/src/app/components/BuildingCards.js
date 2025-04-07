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
        flex flex-col gap-3 p-4 rounded-xl mr-4 
        backdrop-blur-md bg-opacity-20 bg-card 
        shadow-xl hover:shadow-2xl 
        transition-all duration-300 
        cursor-pointer border-none 
        hover:bg-opacity-30 
        transform hover:-translate-y-1`
      }
      onClick={onClick}
      id={convertToIdFormat(name)}
      tabIndex={0}
    >
      <div className="h-[150px] relative rounded-lg overflow-hidden shadow-md">
        {imageError ? (
          <div className="h-full w-full flex items-center justify-center bg-gray-200 rounded-lg">
            <p className="text-sm text-gray-500">Image not available</p>
          </div>
        ) : (
          <Image
            src={imageSrc}
            alt={name || "Building"}
            fill={true}
            quality={75}
            style={{ objectFit: "cover" }}
            className="rounded-lg transition-transform duration-300 hover:scale-105"
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
        <h2 className="font-bold text-xl tracking-tight">{name || "Unknown Building"}</h2>
        <div className="inline-flex gap-1 items-center text-sm font-medium">
          <Star size="14px" fill="#F3C623" strokeWidth={0} />
          <span>{rating != null ? rating.toFixed(1) : "N/A"}</span>
        </div>
      </div>

      <div className="text-sm inline-flex gap-2 items-center mt-1">
        <Clock size="14px" strokeWidth={2} />
        <div className="inline-flex gap-1 items-center">
          {status === "Open" ? (
            <p className="text-emerald-400 font-semibold neon-text-open">
              Open{todayHours[1] && todayHours[1] !== "00:00" ? ` until ${formatTime(todayHours[1])}` : ""}
            </p>
          ) : (
            <p className="text-rose-400 font-semibold neon-text-closed">
              Closed{todayHours.length > 0 ? "" : " today"}
            </p>
          )}
        </div>
      </div>

      <div className="text-sm font-medium inline-flex gap-2 items-center mt-1">
        <Train size="14px" strokeWidth={2} />
        {station || "N/A"} Station
      </div>

      <div className="inline-flex gap-2 items-center justify-between mt-2">
        <p className="text-base font-semibold">
          {coordinates && distance != null ? distance.toFixed(2) : "-"} km{" "}
          <span className="font-light text-sm">away</span>
        </p>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              className="
                inline-flex gap-1 text-sm 
                bg-primary/20 hover:bg-primary/40 
                transition-all duration-300 border-none 
                rounded-lg shadow-sm hover:shadow-md
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
              bg-card/20 backdrop-blur-md text-foreground 
              border-none shadow-lg rounded-xl
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