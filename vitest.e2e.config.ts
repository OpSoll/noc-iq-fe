import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["node_modules/**", "**/*.spec.ts"],
  },
  resolve: {
    alias: {
      "@/tests": path.resolve(__dirname, "./tests"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
