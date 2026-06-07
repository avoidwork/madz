## Context

The project currently has no containerization support. It runs directly on Node.js with no Docker or compose configuration. Developers must install all dependencies manually. There is no mechanism for building multi-platform images.

## Goals / Non-Goals

**Goals:**
- Enable single-command Docker image builds for local testing
- Support multi-architecture builds (AMD64, ARM64) using Docker Buildx
- Provide docker-compose configuration for easy local development
- Add npm scripts that integrate with existing package.json workflow
- Support tagged releases with version and latest tags

**Non-Goals:**
- Kubernetes manifests or orchestration configs
- CI/CD pipeline configuration (out of scope for this change)
- Image optimization beyond standard Node.js best practices
- Multi-stage builds with separate dev/prod configurations

## Decisions

1. **Dockerfile with multi-stage build**: Use Node.js official image as base, separate build and runtime stages to minimize final image size.

2. **Docker Buildx for multiarch**: Leverage Docker's built-in `buildx` with `--platform` flag rather than separate builds. This ensures consistent build context and simplifies multi-platform releases.

3. **docker-compose for local development**: Single service definition that runs the application, using docker-compose up/down for lifecycle management. No additional dependencies (database, cache) required at this time.

4. **Registry tagging convention**: Use `$npm_package_version` from package.json for versioned tags, `latest` for current development, and `-amd64`/`-arm64` suffixes for architecture-specific tags. Use `$DOCKER_USER` env var for registry username.

5. **Builder named `multiarch`**: Use dedicated buildx builder named `multiarch` for multi-platform builds, created with `docker buildx create --name multiarch --use`.

## Risks / Trade-offs

[Risk] Developers without Docker installed won't have the new scripts available.
[Mitigation] Scripts are opt-in via npm run commands; existing `npm start` still works. Document Docker requirement in README for docker-related scripts.

[Risk] Multiarch builds require Docker Buildx configured with multiarch builder.
[Mitigation] Provide error messages directing users to create the builder if missing. Document setup once in README.

[Risk] ARM64 builds may be slower on AMD64 hosts (QEMU emulation).
[Mitigation] This is expected behavior for cross-compilation. Document the performance characteristic so users aren't surprised.

[Risk] Image size could be large with full Node.js dependencies.
[Mitigation] Use multi-stage build to install dependencies separately and copy only dist/prod artifacts into runtime image.
