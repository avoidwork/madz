## ADDED Requirements

### Requirement: Docker image builds for single architecture
The system MUST support building Docker images for a single specified architecture (linux/amd64 or linux/arm64) using the name and version from package.json.

#### Scenario: Build AMD64 image
- **WHEN** developer runs `npm run docker:build:amd64`
- **THEN** docker buildx builds image with platform `linux/amd64` and tags it as `$DOCKER_USER/madz:$npm_package_version-amd64`

#### Scenario: Build ARM64 image
- **WHEN** developer runs `npm run docker:build:arm64`
- **THEN** docker buildx builds image with platform `linux/arm64` and tags it as `$DOCKER_USER/madz:$npm_package_version-arm64`

#### Scenario: Build local image without push
- **WHEN** developer runs `npm run docker:build`
- **THEN** docker builds image tagged as `madz:latest` and stores it locally (no push)

### Requirement: Multi-architecture image builds
The system MUST support building Docker images for both linux/amd64 and linux/arm64 architectures in a single operation.

#### Scenario: Build all architectures
- **WHEN** developer runs `npm run docker:build:all`
- **THEN** docker buildx builds images with platforms `linux/amd64,linux/arm64` and tags as `$DOCKER_USER/madz:$npm_package_version` and pushes

### Requirement: Image tagging
The system MUST support tagging built images with versioned and latest tags for release distribution.

#### Scenario: Tag local image
- **WHEN** developer runs `npm run docker:tag`
- **THEN** docker tags `madz:latest` as `$DOCKER_USER/madz:$npm_package_version`

### Requirement: Image push to registry
The system MUST support pushing tagged images to a Docker registry.

#### Scenario: Push versioned image
- **WHEN** developer runs `npm run docker:push`
- **THEN** docker pushes `$DOCKER_USER/madz:$npm_package_version` to the registry

### Requirement: Release workflows
The system MUST support comprehensive release workflows for single and multi-architecture images.

#### Scenario: Single architecture release (AMD64)
- **WHEN** developer runs `npm run docker:release:amd64`
- **THEN** docker builds, tags, and pushes `linux/amd64` image as `$DOCKER_USER/madz:$npm_package_version-amd64`

#### Scenario: Single architecture release (ARM64)
- **WHEN** developer runs `npm run docker:release:arm64`
- **THEN** docker builds, tags, and pushes `linux/arm64` image as `$DOCKER_USER/madz:$npm_package_version-arm64`

#### Scenario: Full release with latest tag
- **WHEN** developer runs `npm run docker:release`
- **THEN** docker builds locally, creates both versioned and latest tags, and pushes `$DOCKER_USER/madz:$npm_package_version`

#### Scenario: Multi-architecture release with latest tag
- **WHEN** developer runs `npm run docker:release:all`
- **THEN** docker builds multi-architecture images, tags as `$DOCKER_USER/madz:$npm_package_version` and `$DOCKER_USER/madz:latest`, and pushes both

### Requirement: Dockerfile multi-stage build
The Dockerfile MUST use a multi-stage build to separate development dependencies from production runtime.

#### Scenario: Development stage includes all deps
- **WHEN** Dockerfile is built for development context
- **THEN** the first stage installs both dependencies and devDependencies from package.json

#### Scenario: Production stage is minimal
- **WHEN** Dockerfile creates the final runtime image
- **THEN** the final stage installs only dependencies from package.json (no devDependencies) and copies necessary application files

#### Scenario: Dockerfile supports Node.js 20+
- **WHEN** Dockerfile bases on official Node.js image
- **THEN** the base image MUST be Node.js 20 or later per project conventions

### Requirement: Docker Buildx multiarch builder
Multi-architecture builds MUST use a Docker Buildx builder named `multiarch`.

#### Scenario: Builder exists
- **WHEN** developer runs multi-architecture builds
- **THEN** docker buildx uses the `--builder multiarch` flag to target the correct builder

---

## ADDED Requirements

### Requirement: Docker-compose development environment
The system MUST provide a docker-compose.yml file for local development and testing.

#### Scenario: Start development environment
- **WHEN** developer runs `npm run docker:compose:up`
- **THEN** docker-compose starts the application service in detached mode with `docker-compose up -d`

#### Scenario: Stop development environment
- **WHEN** developer runs `npm run docker:compose:down`
- **THEN** docker-compose stops and removes the application service with `docker-compose down`

### Requirement: Docker-compose service configuration
The docker-compose.yml MUST define a service that runs the built Docker image.

#### Scenario: Service definition
- **WHEN** docker-compose.yml is parsed
- **THEN** it MUST configure a service using the application's Docker image, expose appropriate ports, and support environment variable configuration

#### Scenario: Environment variable support
- **WHEN** docker-compose.yml defines environment variables
- **THEN** environment variables MUST be configurable via `.env` file or inline in the compose file
