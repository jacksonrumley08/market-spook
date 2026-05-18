# congresstrade-ui — Phase 6 internal dev server
# Internal-only, single-user, LAN-bound. We run `bun dev` (vite dev) so HMR works
# and TanStack Start's SSR/server routes operate normally. For production-grade
# serving switch to `bun run build` + a Node/wrangler runtime later.

FROM oven/bun:1.2.21-alpine

WORKDIR /srv/app

# Install deps first for layer caching. bunfig.toml enforces the 24h release-age
# supply-chain guard; copy it before installing.
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

# Source mounted at runtime via docker-compose volume; this COPY is just so the
# image is self-contained when run without a mount.
COPY . .

EXPOSE 8003

# The compose mount of /srv/app from the host can shadow the image's node_modules
# (the named volume is empty on first start), so re-run a frozen-lockfile install
# at boot to ensure native bindings exist on the volume. Idempotent and fast.
CMD ["sh", "-c", "bun install --frozen-lockfile && bun run dev"]
