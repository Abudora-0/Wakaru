import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,

  // The core and tokens packages ship TypeScript and CSS directly rather than
  // a build output, so Next compiles them as part of the app.
  transpilePackages: ["@wakaru/core", "@wakaru/ocr", "@wakaru/tokens"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default config;
