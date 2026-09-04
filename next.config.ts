import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SEO-friendly URL rename (2026-09-04): /c/[slug] became
  // /category/[slug], and /search's no-query "browse everything" case got
  // its own name at /collections. Permanent redirects so any bookmarked
  // or externally-linked /c/... URL still lands correctly rather than
  // 404ing, and search engines re-index the new canonical path.
  async redirects() {
    return [
      {
        source: "/c/:slug",
        destination: "/category/:slug",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
