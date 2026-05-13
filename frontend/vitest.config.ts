import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Vitest config kept separate from vite.config.ts: vitest depends on its own
// pinned version of `vite` and the Plugin<any> types from the two installs
// are mutually incompatible. Splitting the files avoids the TS overload error
// that surfaced in CI.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    css: false,
  },
});
