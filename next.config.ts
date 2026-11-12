import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  typescript: {
    // Temporarily ignore build errors to test
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

export default nextConfig;
