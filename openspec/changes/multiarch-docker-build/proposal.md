## Why

The application lacks containerization support for deployment and local testing. Developers have no easy way to run the full application stack locally, and there's no mechanism to build multi-platform images for distribution on both AMD64 and ARM64 architectures.

## What Changes

- Add `Dockerfile` for building the application image (see example below). Runs `npm install` and `npm test` in builder stage.
- Add `docker-compose.yml` for local development and testing with all dependencies
- Add npm scripts for single-architecture builds (`docker:build:amd64`, `docker:build:arm64`)
- Add npm scripts for multi-architecture builds using Docker Buildx (`docker:build:all`, `docker:release:all`)
- Add npm scripts for tagged releases and pushing to registry (`docker:release`, `docker:release:amd64`, `docker:release:arm64`)
- Add npm scripts for docker-compose management (`docker:compose:up`, `docker:compose:down`)

### Example Dockerfile

```dockerfile
FROM node:24-alpine AS builder

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

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY src/ ./src/
COPY config.yaml ./
COPY index.js ./

USER node

EXPOSE 22

ENV NODE_ENV=production

CMD ["node", "index.js"]
```

## Capabilities

### New Capabilities
- `docker-build`: Multi-architecture Docker image building with buildx and platform targeting
- `docker-compose`: Local development and testing environment orchestration

### Modified Capabilities
N/A

## Impact

- New files: `Dockerfile`, `docker-compose.yml`
- Modified: `package.json` (npm scripts)
- New dev dependency: Docker and Docker Buildx tooling
- Developers need Docker installed for local testing via docker-compose
- CI/CD pipelines can leverage multiarch build scripts for release distribution
