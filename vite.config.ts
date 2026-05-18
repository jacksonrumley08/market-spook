// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Self-hosted Phase 6 runtime: bind to 0.0.0.0 so the LAN container is reachable, and
// proxy /api → the congresstrade FastAPI so the browser fetches same-origin (no CORS).
// API_PROXY_TARGET defaults to host.docker.internal (set in docker-compose for Linux);
// for native `bun dev`, export API_PROXY_TARGET=http://localhost:8002 instead.
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? "http://host.docker.internal:8002";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      host: "0.0.0.0",
      port: 8003,
      strictPort: true,
      proxy: {
        "/api": {
          target: API_PROXY_TARGET,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ""),
        },
      },
    },
    preview: {
      host: "0.0.0.0",
      port: 8003,
      strictPort: true,
    },
  },
});
