FROM node:22-slim

WORKDIR /zero
COPY package*.json ./

# install pnpm before we start
RUN npm install --global corepack@latest
RUN corepack enable pnpm

# install deps
RUN pnpm install
COPY . .
RUN pnpm build


# env vars, overriden by the `.env` file via compose
ENV NODE_ENV=production \
    BASE_URL=http://localhost:3000 \
    DATABASE_URL=postgresql://postgres:super-secret-password@localhost:5432/mail0 \
    BETTER_AUTH_SECRET= \
    BETTER_AUTH_URL= \
    GOOGLE_CLIENT_ID= \
    GOOGLE_CLIENT_SECRET= \
    NEXT_PUBLIC_POSTHOG_KEY= \
    NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com \
    REDIS_URL= \
    REDIS_TOKEN=

EXPOSE 3000

CMD ["pnpm", "start"]
