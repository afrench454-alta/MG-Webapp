import os from "os";
import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const lanIps = Object.values(os.networkInterfaces())
  .flat()
  .filter((iface): iface is os.NetworkInterfaceInfo => Boolean(iface && iface.family === "IPv4" && !iface.internal))
  .map((iface) => iface.address);

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: Array.from(new Set(["localhost", "127.0.0.1", "10.0.4.55", "10.0.4.54", ...lanIps])),
  ...(supabaseUrl ? { images: { remotePatterns: [new URL("/storage/v1/object/sign/**", supabaseUrl)] } } : {}),
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  turbopack: {
    // This app is intentionally nested under the workspace; keep dependency
    // discovery and file watching scoped to the production app itself.
    root: process.cwd(),
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
