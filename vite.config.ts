import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

// Für GitHub Pages setzt die CI VITE_BASE auf den Repository-Unterpfad
// (z. B. "/fogtrain/"); lokal und im E2E-Lauf gilt "/".
const base = process.env["VITE_BASE"] ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // Update-Hinweis: neue Version wartet, bis der Nutzer "Aktualisieren" tippt.
      registerType: "prompt",
      manifest: {
        name: "TrainingApp",
        short_name: "TrainingApp",
        description:
          "Übungen verwalten, Trainingspläne bauen, Workouts loggen.",
        lang: "de",
        display: "standalone",
        theme_color: "#0f766e",
        background_color: "#ffffff",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precache aller Build-Dateien, damit die App vollständig offline startet.
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
        navigateFallback: "index.html",
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "tools/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/domain/**", "src/data/**"],
    },
  },
});
