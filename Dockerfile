# use the official Bun image
FROM oven/bun:slim AS base
WORKDIR /zero

# install dependencies into temp directory
FROM base AS install
COPY . .

# rename the example env files and setup
RUN cp apps/mail/.env.example apps/mail/.env && \
    cp packages/db/.env.example packages/db/.env && \
    bun install --frozen-lockfile && \
    bun run db:dependencies && \
    bun run db:push

# build prod image
FROM base AS prerelease
COPY --from=install /zero/node_modules node_modules
COPY --from=install /zero .

# building
ENV NODE_ENV=production
RUN bun run build

# final production image
FROM base AS release
COPY --from=install /zero/node_modules node_modules
COPY --from=prerelease /zero .

# env vars, overridden by the .env file via compose
ENV NODE_ENV=production \
    BASE_URL=http://localhost:3000 \
    DATABASE_URL=postgresql://postgres:super-secret-password@localhost:5432/mail0 \
    BETTER_AUTH_SECRET=your_secret_key \
    BETTER_AUTH_URL= \
    GOOGLE_CLIENT_ID= \
    GOOGLE_CLIENT_SECRET= \
    NEXT_PUBLIC_POSTHOG_KEY= \
    NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com \
    REDIS_URL= \
    REDIS_TOKEN=

EXPOSE 3000

ENTRYPOINT ["bun", "run", "start"]