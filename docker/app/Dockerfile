# ========================================
# Base Stage: Alpine Linux with Bun
# ========================================
FROM oven/bun:alpine AS base

# ========================================
# Dependencies Stage: Install Dependencies
# ========================================
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install turbo globally
RUN bun install -g turbo

COPY package.json bun.lock turbo.json ./
RUN mkdir -p apps packages
COPY apps/*/package.json ./apps/
COPY packages/*/package.json ./packages/
COPY packages/tsconfig/ ./packages/tsconfig/

RUN bun install --omit dev --ignore-scripts

# ========================================
# Builder Stage: Build the Application
# ========================================
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Installing with full context to prevent missing dependencies error
RUN bun install --omit dev --ignore-scripts

# Required for standalone nextjs build
WORKDIR /app/apps/mail
RUN bun install sharp

# Define build arguments
ARG NEXT_PUBLIC_APP_URL \
    DATABASE_URL \
    BETTER_AUTH_SECRET \
    BETTER_AUTH_URL \
    BETTER_AUTH_TRUSTED_ORIGINS \
    GOOGLE_CLIENT_ID \
    GOOGLE_CLIENT_SECRET \
    REDIS_URL \
    REDIS_TOKEN \
    RESEND_API_KEY \
    OPENAI_API_KEY \
    AI_SYSTEM_PROMPT \
    GROQ_API_KEY \
    GOOGLE_GENERATIVE_AI_API_KEY

# Set environment variables for build
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    DATABASE_URL=${DATABASE_URL} \
    BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET} \
    BETTER_AUTH_URL=${BETTER_AUTH_URL} \
    BETTER_AUTH_TRUSTED_ORIGINS=${BETTER_AUTH_TRUSTED_ORIGINS} \
    GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID} \
    GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET} \
    REDIS_URL=${REDIS_URL} \
    REDIS_TOKEN=${REDIS_TOKEN} \
    RESEND_API_KEY=${RESEND_API_KEY} \
    OPENAI_API_KEY=${OPENAI_API_KEY} \
    AI_SYSTEM_PROMPT=${AI_SYSTEM_PROMPT} \
    GROQ_API_KEY=${GROQ_API_KEY} \
    GOOGLE_GENERATIVE_AI_API_KEY=${GOOGLE_GENERATIVE_AI_API_KEY} \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    DOCKER_BUILD=true

WORKDIR /app
RUN bun run build

# ========================================
# Runner Stage: Production Environment
# ========================================
FROM base AS runner
WORKDIR /app

RUN addgroup -S -g 1001 bunjs && \
    adduser -S -u 1001 nextjs -G bunjs

# Define build arguments
ARG NEXT_PUBLIC_APP_URL \
    DATABASE_URL \
    BETTER_AUTH_SECRET \
    BETTER_AUTH_URL \
    BETTER_AUTH_TRUSTED_ORIGINS \
    GOOGLE_CLIENT_ID \
    GOOGLE_CLIENT_SECRET \
    REDIS_URL \
    REDIS_TOKEN \
    RESEND_API_KEY \
    OPENAI_API_KEY \
    AI_SYSTEM_PROMPT \
    GROQ_API_KEY \
    GOOGLE_GENERATIVE_AI_API_KEY

# Set environment variables for build
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    DATABASE_URL=${DATABASE_URL} \
    BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET} \
    BETTER_AUTH_URL=${BETTER_AUTH_URL} \
    BETTER_AUTH_TRUSTED_ORIGINS=${BETTER_AUTH_TRUSTED_ORIGINS} \
    GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID} \
    GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET} \
    REDIS_URL=${REDIS_URL} \
    REDIS_TOKEN=${REDIS_TOKEN} \
    RESEND_API_KEY=${RESEND_API_KEY} \
    OPENAI_API_KEY=${OPENAI_API_KEY} \
    AI_SYSTEM_PROMPT=${AI_SYSTEM_PROMPT} \
    GROQ_API_KEY=${GROQ_API_KEY} \
    GOOGLE_GENERATIVE_AI_API_KEY=${GOOGLE_GENERATIVE_AI_API_KEY} \
    NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0" \
    NEXT_TELEMETRY_DISABLED=1

# Copy public assets
COPY --from=builder --chown=nextjs:bunjs /app/apps/mail/public ./apps/mail/public

# Leverage output traces to reduce image size (standalone output)
COPY --from=builder --chown=nextjs:bunjs /app/apps/mail/.next/standalone ./
COPY --from=builder --chown=nextjs:bunjs /app/apps/mail/.next/static ./apps/mail/.next/static

# Switch to non-root user
USER nextjs

# Set server port and host
EXPOSE 3000

# Start the server
CMD ["bun", "apps/mail/server.js"]