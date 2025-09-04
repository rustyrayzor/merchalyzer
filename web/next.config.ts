import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow remote images from Printify CDN and common storefront CDNs
    remotePatterns: [
      { protocol: "https", hostname: "images.printify.com" },
      { protocol: "https", hostname: "cdn.shopify.com" },
    ],
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
