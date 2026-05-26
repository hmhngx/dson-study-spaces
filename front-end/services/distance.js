import axios from "axios";
import { convertToIdFormat } from "./formatId";

const baseUrl = "/api/buildings";

const isBuildingOpen = (building, datetime) => {
  const day = datetime.toLocaleString('en-US', { weekday: 'long' });
  if (!building.hours || !building.hours[day] || building.hours[day].length !== 2) return false;
  const hoursToday = building.hours[day];
  const [start, end] = hoursToday;
  if (start === "00:00" && end === "24:00") return true;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;
  const currentTime = datetime.getHours() * 60 + datetime.getMinutes();
  return currentTime >= startTime && currentTime <= endTime;
};

function vincentyDistance([lat1, lon1], [lat2, lon2]) {
  const toRadians = (deg) => (deg * Math.PI) / 180;
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const b = a * (1 - f);

  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const L = toRadians(lon2 - lon1);

  let U1 = Math.atan((1 - f) * Math.tan(φ1));
  let U2 = Math.atan((1 - f) * Math.tan(φ2));

  let sinU1 = Math.sin(U1);
  let cosU1 = Math.cos(U1);
  let sinU2 = Math.sin(U2);
  let cosU2 = Math.cos(U2);

  let λ = L;
  let λPrev,
    iterations = 0;
  let sinλ, cosλ, sinσ, cosσ, σ, sinα, cos2α, C;

  do {
    sinλ = Math.sin(λ);
    cosλ = Math.cos(λ);
    sinσ = Math.sqrt(
      (cosU2 * sinλ) ** 2 + (cosU1 * sinU2 - sinU1 * cosU2 * cosλ) ** 2
    );
    if (sinσ === 0) return 0;

    cosσ = sinU1 * sinU2 + cosU1 * cosU2 * cosλ;
    σ = Math.atan2(sinσ, cosσ);

    sinα = (cosU1 * cosU2 * sinλ) / sinσ;
    cos2α = 1 - sinα ** 2;

    C = (f / 16) * cos2α * (4 + f * (4 - 3 * cos2α));
    λPrev = λ;
    λ =
      L +
      (1 - C) *
        f *
        sinα *
        (σ + C * sinσ * (cos2α + C * cosσ * (-1 + 2 * cos2α ** 2)));

    iterations++;
  } while (Math.abs(λ - λPrev) > 1e-12 && iterations < 1000);

  if (iterations >= 1000) {
    throw new Error("Vincenty formula failed to converge.");
  }

  const u2 = cos2α * ((a ** 2 - b ** 2) / b ** 2);
  const A = 1 + (u2 / 16384) * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)));
  const B = (u2 / 1024) * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));

  const Δσ =
    B *
    sinσ *
    (cosσ +
      (B / 4) *
        (cosσ * (-1 + 2 * cosσ ** 2) -
          (B / 6) * cosσ * (-3 + 4 * sinσ ** 2) * (-3 + 4 * cosσ ** 2)));

  const distance = b * A * (σ - Δσ);

  return distance / 1000;
}

function parseBuildingsResponse(data) {
  const buildings = data?.data;
  if (!Array.isArray(buildings)) {
    throw new Error("Invalid buildings response");
  }
  return buildings;
}

function enrichAndSortBuildings(buildings, lat, lng) {
  const current = new Date();
  const buildingsWithDetails = buildings.map((building) => ({
    ...building,
    slug: building.slug ?? convertToIdFormat(building.name),
    id: building.id ?? building.slug ?? convertToIdFormat(building.name),
    status: isBuildingOpen(building, current) ? "Open" : "Closed",
    distance: vincentyDistance([lat, lng], building.coords),
  }));

  buildingsWithDetails.sort((a, b) => a.distance - b.distance);
  return buildingsWithDetails;
}

export async function fetchAndSortBuildings(lat, lng) {
  const url = `${baseUrl}?lat=${lat}&lng=${lng}`;

  try {
    const response = await axios.get(url);
    if (response.status >= 400) {
      throw new Error(`Buildings request failed with status ${response.status}`);
    }
    return enrichAndSortBuildings(parseBuildingsResponse(response.data), lat, lng);
  } catch (error) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        const response = await axios.get(url);
        if (response.status >= 400) {
          throw new Error(`Buildings request failed with status ${response.status}`);
        }
        return enrichAndSortBuildings(parseBuildingsResponse(response.data), lat, lng);
      } catch (retryError) {
        if (attempt === 2) {
          throw new Error("Failed to fetch buildings");
        }
      }
    }
    throw new Error("Failed to fetch buildings");
  }
}
