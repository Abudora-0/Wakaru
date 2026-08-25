import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,

  // The core and tokens packages ship TypeScript and CSS directly rather than
  // a build output, so Next compiles them as part of the app.
  transpilePackages: ["@wakaru/core", "@wakaru/ocr", "@wakaru/tokens"],

  turbopack: {
    resolveAlias: {
      // The Piper voice runtime carries Emscripten glue with a Node branch in
      // it. That branch never executes in a browser, but the specifier still
      // has to resolve, so the Node built ins are aliased to an empty module
      // for the browser build only.
      fs: { browser: "./src/lib/empty-module.ts" },
      path: { browser: "./src/lib/empty-module.ts" },
      crypto: { browser: "./src/lib/empty-module.ts" },
    },
  },

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
