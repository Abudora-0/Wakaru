import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: ".",
  outDir: ".output",

  manifest: {
    name: "Wakaru",
    description: "Read raw manga and manhwa in place. Recognition runs on your machine, nothing is uploaded.",
    version: "0.1.0",

    permissions: [
      "storage",
      "activeTab",
      "scripting",
      "offscreen",
    ],

    /**
     * Site access is requested per site rather than at install time.
     *
     * Asking for every URL up front is the norm for extensions like this and
     * it is the wrong default: it means the extension can read every page a
     * person visits, forever, to serve a feature they use on a handful of
     * sites. Optional permissions cost one click on first use and are far
     * easier to justify in a store review.
     */
    optional_host_permissions: ["*://*/*"],

    action: {
      default_title: "Wakaru",
      default_popup: "popup.html",
    },

    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      128: "icon/128.png",
    },
  },

  vite: () => ({
    // The shared packages ship TypeScript directly rather than a build output.
    optimizeDeps: {
      exclude: ["@wakaru/core", "@wakaru/ocr", "@wakaru/tokens"],
    },
  }),
});
