FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --chown=node:node src/ ./src/
RUN mkdir -p /data && chown node:node /data
USER node
ENV NODE_ENV=production BRIDGE_DATA_DIR=/data PORT=3033
EXPOSE 3033
CMD ["node", "src/server.mjs"]
