FROM node:24-alpine AS builder

RUN apk add --no-cache python3 make g++ bash

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY src/ ./src/
COPY tests/ ./tests/
COPY index.js ./
COPY config.yaml ./

RUN npm test && \
    npm prune --omit=dev && \
    npm cache clean --force

FROM node:24-alpine

RUN apk add --no-cache python3 ruby curl bash && \
    curl -LsSf https://astral.sh/uv/install.sh | sh && \
    mv /root/.local/bin/uv /usr/local/bin/uv

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY src/ ./src/
COPY config.yaml ./
COPY index.js ./

CMD ["node", "index.js", "--mode", "interactive"]
