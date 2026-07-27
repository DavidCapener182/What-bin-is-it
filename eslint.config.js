// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "dist/*",
      ".output/*",
      ".vercel/output/*",
      "api/v1/*.js",
      "council-pilot-crm/**",
      "council-backoffice/**",
    ],
  }
]);
