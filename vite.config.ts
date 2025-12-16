// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  assetsInclude: ["**/*.geojson"],

  // 🔥 IMPORTANT FIX
  build: {
    sourcemap: false,        // ❌ Disable source maps
    minify: "esbuild",       // ✔ Minify JS (default but keep for safety)
    outDir: "dist",          // ✔ Ensure only build output is created
  },
});
