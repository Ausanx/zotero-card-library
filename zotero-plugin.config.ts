// SPDX-License-Identifier: AGPL-3.0-or-later
// Adapted from windingwind/zotero-plugin-template; see NOTICE.
import { defineConfig } from "zotero-plugin-scaffold";
import pkg from "./package.json";

export default defineConfig({
  source: ["src", "addon"],
  dist: ".scaffold/build",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  updateURL:
    process.env.ZCL_UPDATE_URL ||
    "https://github.com/Ausanx/zotero-card-library/releases/download/release/update.json",
  xpiDownloadLink:
    process.env.ZCL_XPI_DOWNLOAD_URL ||
    `https://github.com/Ausanx/zotero-card-library/releases/download/v${pkg.version}/zotero-card-library.xpi`,

  build: {
    assets: ["addon/**/*.*"],
    define: {
      ...pkg.config,
      author: pkg.author,
      description: pkg.description,
      buildVersion: pkg.version,
      buildTime: "{{buildTime}}",
    },
    prefs: {
      prefix: pkg.config.prefsPrefix,
    },
    esbuildOptions: [
      {
        entryPoints: ["src/index.ts"],
        define: {
          __env__: `"${process.env.NODE_ENV || "production"}"`,
        },
        bundle: true,
        target: "firefox115",
        outfile: `.scaffold/build/addon/content/scripts/${pkg.config.addonRef}.js`,
      },
    ],
  },

  test: {
    waitForPlugin: `() => Zotero.${pkg.config.addonInstance}.data.initialized`,
  },

  // If you need to see a more detailed log, uncomment the following line:
  // logLevel: "trace",
});
