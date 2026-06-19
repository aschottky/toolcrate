import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";

/** MPAs live in subfolders; bare paths like /success must map to /success/index.html */
const MPA_ROUTES = [
  "scan",
  "audit-test",
  "app",
  "admin",
  "preview",
  "preview-view",
  "roast",
  "try",
  "checkout",
  "success",
  "blog",
];

function mpaPathRewrite() {
  const rewrite = (req, res, next) => {
    const url = req.url || "/";
    const qIndex = url.indexOf("?");
    const pathname = qIndex === -1 ? url : url.slice(0, qIndex);
    const search = qIndex === -1 ? "" : url.slice(qIndex);
    const bare = pathname.replace(/\/$/, "") || "/";
    if (bare === "/") {
      return next();
    }
    const segment = bare.slice(1);
    if (
      segment &&
      !segment.includes("/") &&
      !segment.includes(".") &&
      MPA_ROUTES.includes(segment)
    ) {
      if (!pathname.endsWith("/")) {
        res.writeHead(302, { Location: `/${segment}/${search}` });
        res.end();
        return;
      }
      req.url = `/${segment}/index.html${search}`;
    }
    next();
  };

  return {
    name: "mpa-path-rewrite",
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
  // Root base for custom domain (usetoolcrate.com). Override with VITE_BASE_PATH=/toolcrate/ for GH project pages.
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [mpaPathRewrite()],
  define: {
    __STRIPE_PUBLISHABLE_KEY__: JSON.stringify(env.STRIPE_PUBLISHABLE_KEY || ""),
    __STRIPE_TEST_PUBLISHABLE_KEY__: JSON.stringify(
      env.STRIPE_TEST_PUBLISHABLE_KEY || ""
    ),
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        scan: resolve(__dirname, "scan/index.html"),
        auditTest: resolve(__dirname, "audit-test/index.html"),
        app: resolve(__dirname, "app/index.html"),
        admin: resolve(__dirname, "admin/index.html"),
        preview: resolve(__dirname, "preview/index.html"),
        previewView: resolve(__dirname, "preview-view/index.html"),
        roast: resolve(__dirname, "roast/index.html"),
        try: resolve(__dirname, "try/index.html"),
        checkout: resolve(__dirname, "checkout/index.html"),
        success: resolve(__dirname, "success/index.html"),
        blog: resolve(__dirname, "blog/index.html"),
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
  };
});
