import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  // Root base for custom domain (usetoolcrate.com). Override with VITE_BASE_PATH=/toolcrate/ for GH project pages.
  base: process.env.VITE_BASE_PATH || "/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        auditTest: resolve(__dirname, "audit-test/index.html"),
        app: resolve(__dirname, "app/index.html"),
        admin: resolve(__dirname, "admin/index.html"),
        preview: resolve(__dirname, "preview/index.html"),
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
