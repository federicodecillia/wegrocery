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
      {
        // Operator pages hold fleet data: never cached (FlyLabs Playbook 7.10).
        // The hashed assets under /_next keep their own long cache.
        source: "/((?!_next/static|_next/image).*)",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
