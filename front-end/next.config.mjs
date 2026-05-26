/** Resolve public API URL at build time (Vercel sets VERCEL_URL when NEXT_PUBLIC_API_URL is unset). */
function resolvePublicApiUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

const publicApiUrl = resolvePublicApiUrl();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "maps.googleapis.com",
        pathname: "/**",
      },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: publicApiUrl,
    NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
  },
  async rewrites() {
    const proxyTarget =
      process.env.BACKEND_URL?.replace(/\/$/, "") ?? publicApiUrl.replace(/\/$/, "");
    return [
      {
        source: "/api/:path*",
        destination: `${proxyTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
