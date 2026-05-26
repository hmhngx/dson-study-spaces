import { getBackendUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

function getInternalApiSecret() {
  return (
    process.env.INTERNAL_API_SECRET?.trim() ||
    process.env.INTERNAL_API_KEY?.trim() ||
    ""
  );
}

export async function GET(request) {
  const secret = getInternalApiSecret();
  if (!secret) {
    return Response.json(
      {
        error:
          "INTERNAL_API_SECRET is not set. Add it to front-end/.env.local (must match back-end).",
      },
      { status: 500 }
    );
  }

  let backendBase;
  try {
    backendBase = getBackendUrl();
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const url = `${backendBase}/api/buildings${query ? `?${query}` : ""}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        Authorization: `Bearer ${secret}`,
      },
      cache: "no-store",
    });

    const body = await upstream.text();
    const headers = { "Content-Type": "application/json" };
    const cacheControl = upstream.headers.get("Cache-Control");
    if (cacheControl) {
      headers["Cache-Control"] = cacheControl;
    }

    return new Response(body, {
      status: upstream.status,
      headers,
    });
  } catch {
    return Response.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}
