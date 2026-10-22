// Configuración de ESLint: reglas de errores reales y de seguridad, sin opiniones de estilo
// (el estilo lo fija .editorconfig). Cada bloque aplica a un tipo de archivo.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

// Reglas comunes a todo el proyecto.
const common = {
  eqeqeq: ["error", "always"],
  "no-var": "error",
  "prefer-const": "error",
  "no-eval": "error",
  "no-implied-eval": "error",
  "no-new-func": "error",
  "no-throw-literal": "error",
};

export default [
  { ignores: ["node_modules/**", "dist/**", ".claude/**"] },
  js.configs.recommended,

  // Backend: TypeScript con comprobación de tipos (detecta promesas descartadas).
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ["src/**/*.ts"] })),
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      ...common,
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      // console solo se admite en los ejemplos y en el registro explícito de errores.
      "no-console": ["warn", { allow: ["error", "warn"] }],
    },
  },
  { files: ["src/**/*.test.ts"], rules: { "@typescript-eslint/no-floating-promises": "off" } },
  // Los ejemplos son scripts de demostración: imprimen por consola a propósito.
  { files: ["src/examples/**/*.ts"], rules: { "no-console": "off" } },

  // Web: scripts clásicos del navegador (comparten el espacio de nombres TaskFlow).
  {
    files: ["web/js/**/*.js", "examples/**/*.js"],
    languageOptions: { sourceType: "script", globals: globals.browser },
    rules: {
      ...common,
      "no-console": ["warn", { allow: ["error", "warn"] }],
      "no-unused-vars": ["error", { args: "after-used", argsIgnorePattern: "^_" }],
    },
  },

  // Pruebas y utilidades de Node en JavaScript moderno.
  {
    files: ["tests/**/*.mjs", "scripts/**/*.mjs", "eslint.config.mjs"],
    languageOptions: { sourceType: "module", globals: { ...globals.node, ...globals.browser } },
    rules: { ...common, "no-console": "off" },
  },
];
