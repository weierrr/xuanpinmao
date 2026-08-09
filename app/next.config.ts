import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    "/*": [
      "prisma/dev.db",
      "config/report-compositions/**/*",
      "config/report-conclusions/**/*",
      "output/research/research-run-3d-yoga-pants-dccf676c3167-us/**/*",
      "output/codex-native/research-run-3d-yoga-pants-dccf676c3167-us/**/*",
      "output/research/research-run-3d-yoga-pants-28f8bff32ab5-us/**/*",
      "output/codex-native/research-run-3d-yoga-pants-28f8bff32ab5-us/**/*",
    ],
  },
};

export default nextConfig;
