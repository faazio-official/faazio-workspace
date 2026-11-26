import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The portal renders real catalogue photos with plain <img> so the UI matches
  // the Vite reference byte-for-byte; image optimisation is intentionally off.
  images: { unoptimized: true },
  // Account security moved into Settings (the standalone superadmin Security page was removed).
  // Keep old bookmarks working instead of 404ing.
  async redirects() {
    return [
      { source: "/admin/super/security", destination: "/admin/super/settings", permanent: true },
    ];
  },
};

export default nextConfig;