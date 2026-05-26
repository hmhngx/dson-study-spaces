import { checkIsOpenNow } from "@/lib/utils";

export const sortBuildings = (buildings, option) => {
  switch (option) {
    case "Closest":
      return [...buildings].sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
    case "Furthest":
      return [...buildings].sort((a, b) => (b.distance || Infinity) - (a.distance || Infinity));
    case "Highest Rated":
      return [...buildings].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case "Name":
      return [...buildings].sort((a, b) => a.name.localeCompare(b.name));
    default:
      return buildings;
  }
};

export const filterBuildings = (buildings, option, now = new Date()) => {
  switch (option) {
    case "Open":
      return buildings.filter((building) => checkIsOpenNow(building.hours, now));
    case "Closed":
      return buildings.filter((building) => !checkIsOpenNow(building.hours, now));
    case "All":
    default:
      return buildings;
  }
};
