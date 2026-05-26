import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { getPublicApiUrl } from "@/lib/env.js";

const API_URL = getPublicApiUrl();

async function fetchActiveNowBuildingIds() {
  const { data: body } = await axios.get(`${API_URL}/api/professors/active-now`);
  if (body.error) throw new Error(body.error);
  return new Set((body.data ?? []).map(String));
}

export function useActiveNowBuildingIds(isLiveModeActive) {
  return useQuery({
    queryKey: ["professors", "active-now"],
    queryFn: fetchActiveNowBuildingIds,
    enabled: isLiveModeActive,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
