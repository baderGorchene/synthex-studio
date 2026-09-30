# Synthex live collaboration server (Hocuspocus/Yjs) for Cloud Run.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server.mjs ./
USER node
EXPOSE 8080
ENV PORT=8080
CMD ["node", "server.mjs"]
