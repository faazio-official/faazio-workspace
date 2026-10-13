import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The portal renders real catalogue photos with plain <img> so the UI matches
  // the Vite reference byte-for-byte; image optimisation is intentionally off.
  images: { unoptimized: true },
};

export default nextConfig;