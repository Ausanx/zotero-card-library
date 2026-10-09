// SPDX-License-Identifier: AGPL-3.0-or-later
// Adapted from windingwind/zotero-plugin-template; see NOTICE.
// @ts-check Let TS check this config file

import zotero from "@zotero-plugin/eslint-config";

export default zotero({
  overrides: [
    {
      files: ["tests/integration/driver.js"],
      languageOptions: { sourceType: "script" },
    },
    {
      files: ["scripts/**/*.mjs", "tests/**/*.mjs"],
      languageOptions: {
        globals: {
          process: "readonly",
          console: "readonly",
          setTimeout: "readonly",
        },
      },
    },
    {
      files: ["**/*.ts"],
      rules: {
        // We disable this rule here because the template
        // contains some unused examples and variables
        "@typescript-eslint/no-unused-vars": "off",
      },
    },
  ],
});
