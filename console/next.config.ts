import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The console is a separate app living in a subfolder of the WeGrocery
  // repository: trace files from here, not from the repository root.
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
