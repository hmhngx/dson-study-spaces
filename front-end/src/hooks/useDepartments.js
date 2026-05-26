import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { getPublicApiUrl } from "@/lib/env.js";

const API_URL = getPublicApiUrl();

async function fetchDepartments() {
  const { data: body } = await axios.get(
    `${API_URL}/api/professors/departments`
  );

  if (body.error) throw new Error(body.error);
  return body.data;
}

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: fetchDepartments,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
