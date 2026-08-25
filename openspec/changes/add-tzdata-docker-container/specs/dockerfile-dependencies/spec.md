# dockerfile-dependencies Spec Delta

## Changes

### New Requirement: tzdata must be installed in the container image

The Dockerfile SHALL include `tzdata` in the `apk add --no-cache` command in the runtime stage, ensuring timezone data is present in every built container image.

#### Scenario: tzdata is in the Dockerfile package list
- **WHEN** the Dockerfile runtime stage is parsed
- **THEN** `tzdata` appears in the `apk add --no-cache` command

#### Scenario: tzdata is available in the container
- **WHEN** the container is built and started
- **THEN** `tzdata` is installed and IANA timezone names (e.g., `America/Toronto`) resolve correctly

### New Requirement: Timezone override via environment variable

The Dockerfile SHALL NOT hardcode a default timezone. The container defaults to UTC, and users may override the timezone by setting the `TZ` environment variable at runtime.

#### Scenario: Container defaults to UTC
- **WHEN** the container is started without `TZ` set
- **THEN** the system timezone is UTC

#### Scenario: Timezone override at runtime
- **WHEN** the container is started with `TZ=America/Toronto`
- **THEN** the system timezone reflects Eastern Time (EST/EDT)
