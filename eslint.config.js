// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "dist/**",
      ".output/**",
      ".vercel/**",
      ".expo/**",
      ".playwright-cli/**",
      ".playwright-mcp/**",
      "output/**",
      "api/v1/*.js",
      "council-pilot-crm/**",
      "council-backoffice/**",
      "services/**/node_modules/**",
    ],
  }
]);
