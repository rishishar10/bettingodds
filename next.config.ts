import type { NextConfig } from "next";

// Pages read published snapshots only, so the site is a static export.
const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: process.env.NEXT_BASE_PATH || undefined,
  // A package-lock.json in the home folder would otherwise be taken as the workspace root.
  outputFileTracingRoot: import.meta.dirname,
};

export default config;
