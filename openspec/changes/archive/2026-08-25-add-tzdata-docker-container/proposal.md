## Why

The madz Docker container uses a minimal Alpine base image that ships without timezone data (`tzdata`). Without it, the container defaults to UTC and cannot resolve IANA timezone names (e.g., `America/Toronto`) when the `TZ` environment variable is set at runtime. This causes incorrect timestamps in logs, misaligned cron schedules, and confusion for users in non-UTC timezones.

## What Changes

- Add `tzdata` to the Alpine package installation in the Dockerfile
- Container defaults to UTC (no hardcoded `ENV TZ`)
- Users can override timezone at runtime via `docker run -e TZ=<IANA_name>`

## Capabilities

### New Capabilities
- **docker-tzdata**: Timezone data support in the Docker container via the `tzdata` Alpine package

### Modified Capabilities
<!-- None — no existing spec-level requirements are changing -->

## Impact

- **Dockerfile** — Package installation line modified (line 20)
- **Image size** — ~1.5MB increase (negligible)
- **Runtime behavior** — Timezone resolution now works when `TZ` is set
- **No code changes** — Application code, entrypoint, and config remain unchanged

## Non-goals

- Hardcoding a default timezone in the Dockerfile
- Adding timezone-aware tests (manual verification is sufficient)
- Changing the Docker base image
- Adding timezone configuration files or symlinks
