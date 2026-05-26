"use client";
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "../styles/Map.css";
import { Button } from "@/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/tooltip";
import { LocateIcon, RotateCw } from "lucide-react";
import { convertToIdFormat } from "../../../services/formatId";
import { checkIsOpenNow, cn, getCampusDateParts, isBuildingOpenAtTime } from "@/lib/utils";
import { getMapboxToken } from "@/lib/env";
import { useLiveTime } from "@/hooks/useLiveTime";

const campusDefaults = getCampusDateParts();

function buildBuildingIdsKey(buildings) {
  return buildings
    .map((b) => b.id ?? convertToIdFormat(b.name))
    .sort()
    .join("|");
}

const Map = forwardRef(({
  data,
  coordinates,
  selectedCoordinates,
  onBuildingClick,
  highlightedBuildingId,
  isLiveModeActive = false,
  liveModeActiveBuildingIds,
  activeView = "spaces",
  isTimeTravelActive = false,
  timeTravelHour = campusDefaults.hour,
  timeTravelDay = campusDefaults.dayName,
  className,
}, ref) => {
  const DEFAULT_CENTER = [-77.1989, 40.2025];
  const DEFAULT_ZOOM = 16;
  const DEFAULT_PITCH = 60;
  const DEFAULT_BEARING = 45;

  const getMapPitch = () =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
      ? 45
      : DEFAULT_PITCH;

  const [mapContextLost, setMapContextLost] = useState(false);
  const [mapRemountKey, setMapRemountKey] = useState(0);
  const mapboxToken = getMapboxToken();

  const mapContainerRef = useRef();
  const mapRef = useRef();
  const markersRef = useRef({});
  const userMarkerRef = useRef(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const onBuildingClickRef = useRef(onBuildingClick);
  onBuildingClickRef.current = onBuildingClick;
  const buildingIdsKey = useMemo(() => buildBuildingIdsKey(data), [data]);
  const liveNow = useLiveTime(60_000);

  useImperativeHandle(ref, () => ({
    flyToLocation(lat, lng) {
      mapRef.current?.flyTo({
        center: [lng, lat],
        zoom: 18,
        pitch: 60,
        bearing: 30,
        duration: 3000,
        essential: true,
      });
    },
  }), []);

  const MARKER_COLORS = {
    blue: {
      bg:     "#3b82f6",
      shadow: "0 0 6px 2px rgba(59,130,246,0.8), 0 0 14px 4px rgba(59,130,246,0.4), 0 2px 4px rgba(0,0,0,0.35)",
    },
    emerald: {
      bg:     "#10b981",
      shadow: "0 0 6px 2px rgba(16,185,129,0.9), 0 0 14px 4px rgba(16,185,129,0.45), 0 2px 4px rgba(0,0,0,0.35)",
    },
    red: {
      bg:     "#ef4444",
      shadow: "0 0 6px 2px rgba(239,68,68,0.9), 0 0 14px 4px rgba(239,68,68,0.45), 0 2px 4px rgba(0,0,0,0.35)",
    },
  };

  function applyMarkerColor(coreEl, colorKey) {
    const { bg, shadow } = MARKER_COLORS[colorKey];
    coreEl.style.backgroundColor = bg;
    coreEl.style.boxShadow = shadow;
  }

  const applyAllMarkerStyles = useCallback(() => {
    const entries = Object.entries(markersRef.current);
    if (entries.length === 0) return;

    entries.forEach(([id, { inner, coreEl, hours }]) => {
      inner.style.transition = "opacity 0.4s ease, filter 0.4s ease, transform 0.4s ease";

      if (activeView === "spaces") {
        const campus = getCampusDateParts(liveNow);
        const timeStr = `${String(timeTravelHour).padStart(2, "0")}:00`;
        const effectiveDay = isTimeTravelActive ? timeTravelDay : campus.dayName;
        const effectiveTime = isTimeTravelActive
          ? timeStr
          : `${String(campus.hour).padStart(2, "0")}:00`;
        const isOpen = isTimeTravelActive
          ? isBuildingOpenAtTime(hours, effectiveDay, effectiveTime)
          : checkIsOpenNow(hours, liveNow);
        applyMarkerColor(coreEl, isOpen ? "emerald" : "red");
        inner.style.opacity   = isOpen ? "1" : "0.3";
        inner.style.filter    = isOpen ? ""  : "grayscale(100%)";
        inner.style.transform = "";
      } else {
        applyMarkerColor(coreEl, "blue");

        const isHighlighted = String(id) === String(highlightedBuildingId);

        if (isLiveModeActive) {
          const numId = Number(id);
          const isActive =
            liveModeActiveBuildingIds?.has(numId) ||
            liveModeActiveBuildingIds?.has(id);

          if (isActive) {
            inner.style.opacity   = "1";
            inner.style.filter    = "";
            inner.style.transform = isHighlighted ? "scale(1.5)" : "scale(1.4)";
          } else {
            inner.style.opacity   = "0.35";
            inner.style.filter    = "grayscale(100%)";
            inner.style.transform = "";
          }
        } else {
          inner.style.opacity   = "";
          inner.style.filter    = "";
          inner.style.transform = isHighlighted ? "scale(1.3)" : "";
        }
      }
    });
  }, [
    activeView,
    highlightedBuildingId,
    isLiveModeActive,
    liveModeActiveBuildingIds,
    liveNow,
    isTimeTravelActive,
    timeTravelHour,
    timeTravelDay,
  ]);

  const handleReloadMap = () => {
    setMapContextLost(false);
    Object.values(markersRef.current).forEach(({ marker }) => marker.remove());
    markersRef.current = {};
    setMapRemountKey((k) => k + 1);
  };

  useEffect(() => {
    if (!mapboxToken) {
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    const initialPitch = getMapPitch();

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      style: "mapbox://styles/mapbox/standard",
      config: {
        basemap: {
          lightPreset: "night",
          show3dObjects: true,
        },
      },
      pitch: initialPitch,
      bearing: DEFAULT_BEARING,
      projection: "globe",
      cooperativeGestures: true,
    });

    const canvas = mapRef.current.getCanvas();

    const onContextLost = (e) => {
      e.preventDefault();
      setMapContextLost(true);
    };

    const onContextRestored = () => {
      setMapContextLost(false);
    };

    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);

    mapRef.current.on("load", () => {
      mapRef.current?.resize();
    });

    return () => {
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mapRemountKey, mapboxToken]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || !mapboxToken) return;

    const observer = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [mapRemountKey, mapboxToken]);

  useEffect(() => {
    if (!mapRef.current) return;

    const buildings = dataRef.current;

    Object.values(markersRef.current).forEach(({ marker }) => marker.remove());
    markersRef.current = {};

    buildings.forEach((building) => {
      const wrapper = document.createElement("div");

      const inner = document.createElement("div");
      inner.className = "fixed-marker-container";
      inner.innerHTML = '<div class="fixed-core"></div>';
      wrapper.appendChild(inner);

      const coreEl = inner.querySelector(".fixed-core");

      inner.addEventListener("click", () => {
        mapRef.current?.flyTo({
          center: [building.coords[1], building.coords[0]],
          zoom: DEFAULT_ZOOM + 2,
          pitch: DEFAULT_PITCH,
          bearing: DEFAULT_BEARING,
          duration: 2000,
        });

        if (onBuildingClickRef.current) {
          onBuildingClickRef.current(building);
        } else {
          const buildingCardItem = document.getElementById(convertToIdFormat(building.name));
          mapRef.current?.once("moveend", () => {
            buildingCardItem?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        }
      });

      const marker = new mapboxgl.Marker({ element: wrapper, anchor: "center" })
        .setLngLat([building.coords[1], building.coords[0]])
        .addTo(mapRef.current);

      const markerKey = building.id ?? convertToIdFormat(building.name);
      markersRef.current[markerKey] = {
        marker,
        inner,
        coreEl,
        hours: building.hours,
      };
    });

    applyAllMarkerStyles();

    return () => {
      Object.values(markersRef.current).forEach(({ marker }) => marker.remove());
      markersRef.current = {};
    };
  }, [buildingIdsKey, mapRemountKey]);

  useEffect(() => {
    userMarkerRef.current?.remove();
    userMarkerRef.current = null;

    if (!coordinates || !mapRef.current) return;

    const userPos = document.createElement("div");
    userPos.className =
      "h-5 w-5 border-[2px] border-white rounded-full bg-blue-500 shadow-[0_0_8px_4px_rgba(59,130,246,1)] animate-pulse";

    userMarkerRef.current = new mapboxgl.Marker(userPos)
      .setLngLat([coordinates[1], coordinates[0]])
      .addTo(mapRef.current);

    return () => {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
    };
  }, [coordinates, mapRemountKey]);

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

  useEffect(() => {
    applyAllMarkerStyles();
  }, [applyAllMarkerStyles]);

  const handleMapReset = () => {
    mapRef.current?.flyTo({
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: DEFAULT_PITCH,
      bearing: DEFAULT_BEARING,
      duration: 2000,
    });
  };

  const handleFlyToMe = () => {
    if (coordinates) {
      mapRef.current?.flyTo({
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
      <div className={cn("relative h-full w-full", className)}>
        <div ref={mapContainerRef} className="h-full w-full" />
        {!mapboxToken && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background/90 backdrop-blur-md px-6"
            role="alert"
          >
            <p className="text-center text-foreground font-medium max-w-md">
              Map is unavailable: set{" "}
              <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
                NEXT_PUBLIC_MAPBOX_TOKEN
              </code>{" "}
              in <code className="text-sm bg-muted px-1.5 py-0.5 rounded">front-end/.env.local</code>,
              then restart <code className="text-sm bg-muted px-1.5 py-0.5 rounded">npm run dev</code>.
            </p>
            <p className="text-center text-muted-foreground text-sm max-w-md">
              Create a free public token at{" "}
              <a
                href="https://account.mapbox.com/access-tokens/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-primary"
              >
                mapbox.com/access-tokens
              </a>
              .
            </p>
          </div>
        )}
        {mapContextLost && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-md"
            role="alert"
          >
            <p className="text-center text-foreground font-medium px-6 max-w-sm">
              Map paused — tap Reload Map to restore.
            </p>
            <Button
              onClick={handleReloadMap}
              variant="secondary"
              className="bg-secondary/90 font-semibold shadow-lg"
            >
              Reload Map <RotateCw size="14px" className="ml-2" />
            </Button>
          </div>
        )}
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex flex-col gap-2 sm:gap-3 z-10 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] max-w-[calc(50%-0.5rem)]">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleMapReset}
                variant="secondary"
                size="icon"
                aria-label="Reset map to default view"
                className="
                  bg-secondary/80 text-foreground hover:bg-secondary/60 active:bg-secondary/50
                  backdrop-blur-md shadow-lg rounded-xl 
                  transition-all duration-300 border-none
                  sm:min-w-0 sm:w-auto sm:h-11 sm:px-4
                "
              >
                <RotateCw size="16px" className="shrink-0 sm:mr-2" />
                <span className="hidden sm:inline font-semibold text-sm">Reset Map</span>
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
                size="icon"
                aria-label={coordinates ? "Fly to your current location" : "Location not available"}
                className="
                  bg-secondary/80 text-foreground hover:bg-secondary/60 active:bg-secondary/50
                  backdrop-blur-md shadow-lg rounded-xl 
                  transition-all duration-300 border-none
                  sm:min-w-0 sm:w-auto sm:h-11 sm:px-4
                "
                disabled={!coordinates}
              >
                <LocateIcon size="16px" className="shrink-0 sm:mr-2" />
                <span className="hidden sm:inline font-semibold text-sm">Fly to Me</span>
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
});

Map.displayName = "Map";

export default Map;
