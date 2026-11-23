import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "@sparticuz/chromium",
  ],

  outputFileTracingIncludes: {
  "/api/generate-recap": [
    "./node_modules/playwright-core/browsers.json",
    "./node_modules/@sparticuz/chromium/bin/**/*",
  ],
  "/*": [
    "./node_modules/@sparticuz/chromium/bin/**/*",
  ],
},
};

export default nextConfig;
