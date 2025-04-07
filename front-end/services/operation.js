export const sortBuildings = (buildings, option) => {
  console.log("Sorting buildings with option:", option);
  console.log("Buildings before sorting:", buildings);

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

export const filterBuildings = (buildings, option) => {
  console.log("Filtering buildings with option:", option);
  console.log("Buildings before filtering:", buildings);

  switch (option) {
    case "Open":
      return buildings.filter((building) => building.status === "Open");
    case "Closed":
      return buildings.filter((building) => building.status === "Closed");
    case "All":
    default:
      return buildings;
  }
};