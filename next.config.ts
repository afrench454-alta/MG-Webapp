import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
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
};

export default nextConfig;
