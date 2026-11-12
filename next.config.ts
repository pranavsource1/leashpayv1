import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  typescript: {
    // Temporarily ignore build errors to test
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
