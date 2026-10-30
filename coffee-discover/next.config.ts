import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in a subfolder of a repo that also holds the old Workshop app;
  // pin the root so its configs (Tailwind, PostCSS, lockfile) don't leak in.
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
  // Product images come from arbitrary roaster CDNs, so we use plain <img> tags
  // rather than next/image (which would need every host allow-listed).
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
      ],
    }];
  },
};

export default nextConfig;
