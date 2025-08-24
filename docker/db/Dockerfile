# ========================================
# Dependencies Stage: Install Dependencies
# ========================================
FROM node:22-alpine AS deps
WORKDIR /app

RUN npm install -g pnpm

# Copy workspace configuration and package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/ ./packages/
COPY patches/ ./patches/

# Install dependencies needed for migrations
RUN pnpm install --frozen-lockfile

# ========================================
# Runner Stage: Production Environment
# ========================================
FROM node:22-alpine AS runner
WORKDIR /app

RUN npm install -g pnpm

# Copy workspace configuration and dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Copy server app with database configuration
COPY apps/server/ ./apps/server/
COPY packages/ ./packages/

WORKDIR /app/apps/server