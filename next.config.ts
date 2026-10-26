import type { NextConfig } from "next";

// Pages read published snapshots only, so the site is a static export.
const config: NextConfig = { output: "export" };

export default config;
