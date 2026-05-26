/**
 * Public environment variables required at build/runtime for client-side API calls.
 */

export function getPublicApiUrl() {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url || String(url).trim() === "") {
    throw new Error("NEXT_PUBLIC_API_URL is missing");
  }
  return String(url).trim();
}

/** Mapbox public access token (client-side map). Returns null when unset. */
export function getMapboxToken() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || String(token).trim() === "") {
    return null;
  }
  return String(token).trim();
}

/**
 * Server-side backend URL for Next.js route handlers (proxy).
 */
export function getBackendUrl() {
  const url =
    process.env.BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_URL;
  if (!url || String(url).trim() === "") {
    throw new Error(
      "BACKEND_URL or NEXT_PUBLIC_API_URL is required for server-side API proxy"
    );
  }
  return String(url).trim().replace(/\/$/, "");
}
