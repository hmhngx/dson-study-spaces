import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { getPublicApiUrl } from "@/lib/env.js";

const API_URL = getPublicApiUrl();

async function fetchProfessors({ queryKey }) {
  const [, searchQuery, departmentId, liveSync] = queryKey;

  const params = new URLSearchParams();
  if (searchQuery) params.set("q", searchQuery);
  if (departmentId) params.set("department_id", departmentId);
  if (liveSync) params.set("live_sync", "true");

  const { data: body } = await axios.get(
    `${API_URL}/api/professors?${params.toString()}`
  );

  if (body.error) throw new Error(body.error);
  return body.data;
}

export function useProfessors(searchQuery = "", departmentId = "", options = {}) {
  const { liveSync = false, enabled = true } = options;

  return useQuery({
    queryKey: ["professors", searchQuery, departmentId, liveSync],
    queryFn: fetchProfessors,
    enabled,
    staleTime: 30_000,
  });
}
