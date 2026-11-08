import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const mediaBase = new URL(
  process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "http://localhost:9000/caravansara-media",
);

const nextConfig: NextConfig = {
  // A small self-contained server for the Docker image (research R15).
  output: "standalone",
  poweredByHeader: false,
  images: {
    // Photos load straight from the system's own storage (or its CDN in production), not through the Next.js
    // optimizer: inside the container the storage's public address (localhost:9000) is not reachable, and
    // resizing photos again here would only repeat the CDN's work. The content security policy allows only
    // this origin (FR-018, FR-041).
    unoptimized: true,
    remotePatterns: [
      {
        protocol: mediaBase.protocol.replace(":", "") as "http" | "https",
        hostname: mediaBase.hostname,
        port: mediaBase.port,
        pathname: `${mediaBase.pathname.replace(/\/$/, "")}/**`,
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // The browser must not guess a file's type from its content.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Sends only the origin to other sites. Not "no-referrer": the OpenStreetMap tile policy
          // requires a Referer (research R22).
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
