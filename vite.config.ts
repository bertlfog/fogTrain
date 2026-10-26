import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "tools/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/domain/**", "src/data/**"],
    },
  },
});
