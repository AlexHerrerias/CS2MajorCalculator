import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Test config lives in vitest.config.ts to avoid the Plugin<any> type clash
// between the top-level `vite` and the `vite` that ships inside `vitest`.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: false,
  },
  build: {
    outDir: "build",
    sourcemap: true,
  },
});
