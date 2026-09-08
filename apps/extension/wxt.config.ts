import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: ".",
  outDir: ".output",

  // A function rather than a plain object, because Firefox needs a slightly
  // different permission list: it has no offscreen API at all, unlike
  // Chrome, where a service worker needs one to get a DOM. Requesting a
  // permission Firefox has never heard of is harmless in practice, but an
  // unrecognised permission is exactly the kind of thing a store review
  // stops to ask about, so it is left out rather than explained away later.
  manifest: ({ browser }) => ({
    name: "Wakaru",
    description: "Read raw manga and manhwa in place. Recognition runs on your machine, nothing is uploaded.",
    version: "0.1.0",

    permissions: [
      "storage",
      "activeTab",
      "scripting",
      ...(browser === "firefox" ? [] : ["offscreen"]),
    ],

    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: {
              // A stable ID Firefox can track across updates and, eventually,
              // AMO signing. It only needs to look like an address and be
              // unique to this extension, not resolve anywhere.
              id: "wakaru@abudora-0.github.io",
              // The extension collects nothing of its own: recognition runs
              // locally and settings live in the browser's own sync storage,
              // not on a server this project controls. The one thing that
              // does leave the device, the text a reader chose to translate,
              // goes to whatever endpoint they configured, which the popup
              // and the README already say plainly, so it is not something
              // this declaration needs to soften or hide.
              data_collection_permissions: { required: ["none"] },
            },
          },
        }
      : {}),

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
  }),

  vite: () => ({
    // The shared packages ship TypeScript directly rather than a build output.
    optimizeDeps: {
      exclude: ["@wakaru/core", "@wakaru/ocr", "@wakaru/tokens"],
    },
  }),
});
