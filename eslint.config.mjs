import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "**/coverage/**",
    // CSS gerado pelo Tailwind, e a pasta local com as soluções de referência (não versionada).
    "apps/web/public/styles.css",
    "desafios/**",
    "scripts/e2e/shots/**"
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["apps/api/**/*.ts", "scripts/**/*.{mjs,mts}"],
    languageOptions: { globals: globals.node }
  },
  {
    // O E2E roda em Node, mas passa funções para `page.evaluate`, executadas dentro do navegador.
    files: ["scripts/e2e/e2e.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } }
  },
  {
    // Frontend: módulos ES no navegador, sem bundler.
    files: ["apps/web/public/js/**/*.js"],
    languageOptions: { sourceType: "module", globals: globals.browser }
  },
  {
    rules: {
      // Parâmetros e variáveis iniciados por "_" são ignorados de propósito.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }
      ]
    }
  }
]);
