"use client";
import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Button } from "@/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/tooltip";
import { LocateIcon, RotateCw } from "lucide-react";
import { convertToIdFormat } from "../../../services/formatId";

const Map = ({ data, coordinates, selectedCoordinates }) => {
  const DEFAULT_CENTER = [-77.1989, 40.2025];
  const DEFAULT_ZOOM = 16;
  const DEFAULT_PITCH = 60;
  const DEFAULT_BEARING = 45;

  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pitch, setPitch] = useState(DEFAULT_PITCH);
  const [bearing, setBearing] = useState(DEFAULT_BEARING);
  const mapContainerRef = useRef();
  const mapRef = useRef();
  const markersRef = useRef([]);

  function getColorByStatus(status) {
    switch (status) {
      case "Open":
        return "h-4 w-4 rounded-full cursor-pointer bg-green-500 shadow-[0_0_8px_4px_rgba(34,197,94,0.9)] animate-pulse";
      case "Closed":
        return "h-4 w-4 rounded-full cursor-pointer bg-red-500 shadow-[0_0_8px_4px_rgba(239,68,68,1)] animate-pulse";
      default:
        return "h-4 w-4 rounded-full bg-gray-400";
    }
  }

  useEffect(() => {
    console.log("Mapbox Token:", process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
    mapboxgl.accessToken = 
    "pk.eyJ1IjoiaGFycmlzb25uZ3V5ZW4xNyIsImEiOiJjbTkyM2lhbTMwN211MmxvYzR4dzE5emk5In0.nRvmZSRQg38IQab28IBVkQ";

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      style: "mapbox://styles/mapbox/standard",
      pitch: DEFAULT_PITCH,
      bearing: DEFAULT_BEARING,
      projection: "globe",
    });

    console.log("Map initialized:", mapRef.current);

    mapRef.current.on("style.load", () => {
      mapRef.current.setConfigProperty("basemap", "lightPreset", "night");
      mapRef.current.setConfigProperty("basemap", "show3dObjects", true);
      console.log("Current light preset:", mapRef.current.getConfigProperty("basemap", "lightPreset"));
    });

    mapRef.current.on("move", () => {
      if (mapRef.current) {
        const mapCenter = mapRef.current.getCenter();
        setCenter([mapCenter.lng, mapCenter.lat]);
        setZoom(mapRef.current.getZoom());
        setPitch(mapRef.current.getPitch());
        setBearing(mapRef.current.getBearing());
      }
    });

    console.log("Map Data:", data);
    if (data.length > 0) {
      data.forEach((building) => {
        console.log(`Building: ${building.name}, Coords:`, building.coords);
        const el = document.createElement("div");
        el.className = getColorByStatus(building.status);

        el.addEventListener("click", () => {
          mapRef.current?.flyTo({
            center: [building.coords[1], building.coords[0]],
            zoom: DEFAULT_ZOOM + 2,
            pitch: DEFAULT_PITCH,
            bearing: DEFAULT_BEARING,
            duration: 2000,
          });

          const buildingCardItem = document.getElementById(convertToIdFormat(building.name));
          mapRef.current?.once("moveend", () => {
            if (buildingCardItem) {
              buildingCardItem.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }
          });
        });

        if (mapRef.current && building.coords) {
          const marker = new mapboxgl.Marker(el)
            .setLngLat([building.coords[1], building.coords[0]])
            .addTo(mapRef.current);
          markersRef.current.push(marker);
        }
      });
    }

    if (coordinates) {
      const userPos = document.createElement("div");
      userPos.className =
        "h-5 w-5 border-[2px] border-white rounded-full bg-blue-500 shadow-[0_0_8px_4px_rgba(59,130,246,1)] animate-pulse";

      const userMarker = new mapboxgl.Marker(userPos)
        .setLngLat([coordinates[1], coordinates[0]])
        .addTo(mapRef.current);
      markersRef.current.push(userMarker);
    }

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, [data]);

  useEffect(() => {
    if (selectedCoordinates) {
      mapRef.current?.flyTo({
        center: [selectedCoordinates[1], selectedCoordinates[0]],
        zoom: DEFAULT_ZOOM + 2,
        pitch: DEFAULT_PITCH,
        bearing: DEFAULT_BEARING,
        duration: 2000,
      });
    }
  }, [selectedCoordinates]);

  const handleMapReset = () => {
    mapRef.current.flyTo({
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: DEFAULT_PITCH,
      bearing: DEFAULT_BEARING,
      duration: 2000,
    });
  };

  const handleFlyToMe = () => {
    if (coordinates) {
      mapRef.current.flyTo({
        center: [coordinates[1], coordinates[0]],
        zoom: DEFAULT_ZOOM + 2,
        pitch: DEFAULT_PITCH,
        bearing: DEFAULT_BEARING,
        duration: 2000,
      });
    }
  };

  return (
    <TooltipProvider>
      <div className="h-screen w-full relative">
        <div ref={mapContainerRef} className="h-full w-full" />
        <div className="absolute top-4 right-4 flex flex-col gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleMapReset}
                variant="secondary"
                className="
                  bg-secondary/80 text-foreground hover:bg-secondary/60 
                  backdrop-blur-md shadow-lg rounded-xl 
                  transition-all duration-300 border-none
                  font-semibold
                "
              >
                Reset Map <RotateCw size="14px" className="ml-2" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Reset map to default view</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleFlyToMe}
                variant="secondary"
                className="
                  bg-secondary/80 text-foreground hover:bg-secondary/60 
                  backdrop-blur-md shadow-lg rounded-xl 
                  transition-all duration-300 border-none
                  font-semibold
                "
                disabled={!coordinates}
              >
                Fly to Me <LocateIcon size="14px" className="ml-2" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{coordinates ? "Fly to your current location" : "Location not available"}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default Map;