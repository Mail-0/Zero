FROM node:22-slim

WORKDIR /zero
COPY . .

# rename the example env files
RUN cp apps/mail/.env.example apps/mail/.env
RUN cp packages/db/.env.example packages/db/.env

# install pnpm before we start
RUN npm install --global corepack@latest
RUN corepack enable pnpm

# setup init db + deps
RUN pnpm db:dependencies
RUN pnpm db:push

# install everything in prod mode
RUN pnpm install
RUN pnpm build


# env vars, overriden by the `.env` file via compose
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

CMD ["pnpm", "start"]
