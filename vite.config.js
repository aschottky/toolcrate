import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/toolcrate/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        auditTest: resolve(__dirname, "audit-test/index.html"),
        app: resolve(__dirname, "app/index.html"),
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
