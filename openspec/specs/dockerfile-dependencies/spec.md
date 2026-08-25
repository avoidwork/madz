# dockerfile-dependencies Specification

## Purpose
TBD - created by archiving change add-gh-cli-dockerfile-dependency. Update Purpose after archive.
## Requirements
### Requirement: gh CLI must be installed in the container image
The Dockerfile SHALL include `gh` in the `apk add --no-cache` command in the runtime stage, ensuring the GitHub CLI binary is present in every built container image.

#### Scenario: gh is in the Dockerfile package list
- **WHEN** the Dockerfile runtime stage is parsed
- **THEN** `gh` appears in the `apk add --no-cache` command

#### Scenario: gh is available in the container
- **WHEN** the container is built and started
- **THEN** `gh --version` executes successfully without "command not found"

### Requirement: tzdata must be installed in the container image

The Dockerfile SHALL include `tzdata` in the `apk add --no-cache` command in the runtime stage, ensuring timezone data is present in every built container image.

#### Scenario: tzdata is in the Dockerfile package list
- **WHEN** the Dockerfile runtime stage is parsed
- **THEN** `tzdata` appears in the `apk add --no-cache` command

#### Scenario: tzdata is available in the container
- **WHEN** the container is built and started
- **THEN** `tzdata` is installed and IANA timezone names (e.g., `America/Toronto`) resolve correctly

### Requirement: Timezone override via environment variable

The Dockerfile SHALL NOT hardcode a default timezone. The container defaults to UTC, and users may override the timezone by setting the `TZ` environment variable at runtime.

#### Scenario: Container defaults to UTC
- **WHEN** the container is started without `TZ` set
- **THEN** the system timezone is UTC

#### Scenario: Timezone override at runtime
- **WHEN** the container is started with `TZ=America/Toronto`
- **THEN** the system timezone reflects Eastern Time (EST/EDT)

