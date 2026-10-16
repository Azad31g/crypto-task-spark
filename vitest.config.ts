import { defineConfig } from "vitest/config";

// Test server handlers directly, without Vite's server-RPC transformation.
export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: { include: ["src/**/*.test.ts"] },
});