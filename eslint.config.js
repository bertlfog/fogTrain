import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Schichtregel (SPEC Abschnitt 4): Abhängigkeit nur nach unten.
 * UI -> Domäne -> Datenschicht (Interfaces) -> Modell.
 * Nur `src/app` (Composition Root) darf alles verdrahten.
 */
const forbid = (message, ...group) => ({
  patterns: [{ group, message }],
});

const ui = ["**/ui", "**/ui/**"];
const app = ["**/app", "**/app/**"];
const domain = ["**/domain", "**/domain/**"];
const indexeddb = ["**/data/indexeddb", "**/data/indexeddb/**", "idb"];
const data = ["**/data", "**/data/**"];
const react = ["react", "react-dom", "react-dom/*", "react/*"];

export default tseslint.config(
  {
    ignores: ["dist", "coverage", "playwright-report", "test-results"],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["*.js", "*.ts", "tools/**/*.ts", "e2e/**/*.ts"],
    languageOptions: { globals: { ...globals.node } },
  },
  // UI: kein direkter Zugriff auf IndexedDB (Repositories kommen per Context).
  {
    files: ["src/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        forbid(
          "Die UI darf IndexedDB nicht direkt nutzen. Repositories per React-Context verwenden (SPEC 4).",
          ...indexeddb,
          ...app,
        ),
      ],
    },
  },
  // Domäne: reine Logik, kein React, keine UI, keine IndexedDB-Implementierung.
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        forbid(
          "Die Domäne darf weder UI, React noch die IndexedDB-Implementierung kennen (SPEC 4).",
          ...ui,
          ...app,
          ...indexeddb,
          ...react,
        ),
      ],
    },
  },
  // Datenschicht: kennt nur das Modell.
  {
    files: ["src/data/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        forbid(
          "Die Datenschicht darf nur das Modell importieren (SPEC 4).",
          ...ui,
          ...app,
          ...domain,
          ...react,
        ),
      ],
    },
  },
  // Modell: keine Abhängigkeiten.
  {
    files: ["src/model/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        forbid(
          "Das Modell hat keine Abhängigkeiten (SPEC 4).",
          ...ui,
          ...app,
          ...domain,
          ...data,
          ...react,
        ),
      ],
    },
  },
);
