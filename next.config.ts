import type { NextConfig } from "next";
import { brandImagePatterns } from "./lib/brand/image-patterns";

const nextConfig: NextConfig = {
  images: {
    // Only the brand logo's own host, never a wildcard — see image-patterns.ts.
    remotePatterns: brandImagePatterns(process.env.NEXT_PUBLIC_BRAND_JSON),
  },
  // Next.js does not automatically include arbitrary fs.readFileSync targets
  // in the serverless build artifact. The /changelog and /guida pages read
  // CHANGELOG.md and CHANGELOG.it.md at runtime, so we explicitly list them
  // here to make sure Vercel ships them inside the lambda bundle.
  outputFileTracingIncludes: {
    "/changelog": ["./CHANGELOG.md", "./CHANGELOG.it.md"],
    "/guida": ["./CHANGELOG.md", "./CHANGELOG.it.md"],
  },
};

export default nextConfig;
