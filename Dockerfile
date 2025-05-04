FROM oven/bun:canary

ENV DATABASE_URL="postgres://placeholder"
ENV REDIS_URL="redis://placeholder"
ENV BETTER_AUTH_SECRET="dummy"
ENV GOOGLE_CLIENT_ID="dummy"
ENV GOOGLE_CLIENT_SECRET="dummy"

WORKDIR /app

# Install turbo globally
RUN bun install -g next turbo


COPY package.json bun.lock turbo.json ./

RUN mkdir -p apps packages

COPY apps/*/package.json ./apps/
COPY packages/*/package.json ./packages/
COPY packages/tsconfig/ ./packages/tsconfig/

RUN bun install

COPY . .

# Installing with full context. Prevent missing dependencies error. 
RUN bun install


RUN bun run build 

ENV NODE_ENV=production

# Resolve Nextjs TextEncoder error.
ENV NODE_OPTIONS=--no-experimental-fetch

EXPOSE 3000

CMD ["bun", "run", "start", "--host", "0.0.0.0"]
