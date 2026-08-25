## Context

The madz Docker image uses `node:24-alpine` as its base. Alpine images are minimal and do not include timezone data by default. The production stage installs ~20 system packages via `apk add` on line 20 of the Dockerfile. No timezone configuration exists anywhere in the Dockerfile or entrypoint.

## Goals / Non-Goals

**Goals:**
- Install `tzdata` in the Docker image so IANA timezone names resolve at runtime
- Container defaults to UTC — no hardcoded timezone
- Users override timezone via `TZ` environment variable at runtime

**Non-Goals:**
- Hardcoding a default timezone
- Adding timezone-aware tests
- Changing the base image or entrypoint
- Adding timezone configuration files

## Decisions

1. **Append `tzdata` to existing `apk add` line** — Minimal change, single line in Dockerfile. No new layers, no new instructions.
   - *Alternative:* Separate `RUN apk add tzdata` — creates an extra layer, unnecessary.
   - *Rationale:* Single layer, no image size penalty beyond the package itself.

2. **No `ENV TZ` in Dockerfile** — Let the container default to UTC.
   - *Alternative:* Set `ENV TZ=America/Toronto` — forces a timezone on all users.
   - *Rationale:* UTC is the Linux standard. Users who need a specific timezone pass `-e TZ` at runtime.

3. **No entrypoint changes** — `docker-entrypoint.sh` does not set or override `TZ`.
   - *Verification:* Confirmed by reading the file — no TZ references found.

## Risks / Trade-offs

- **Image size** — `tzdata` adds ~1.5MB. Mitigation: negligible compared to the total image size (~500MB+ with node_modules).
- **No default timezone** — Users who don't set `TZ` get UTC. Mitigation: this is the expected Linux behavior and the safest default.
- **No automated tests** — Docker image behavior verified manually. Mitigation: sufficient for a single-line change; adding Docker tests is out of scope.

## Migration Plan

1. Merge PR to `main`
2. Rebuild Docker images via `npm run docker:release:all`
3. Verify with `docker run --rm <image> date` (UTC) and `docker run --rm -e TZ=America/Toronto <image> date` (Eastern)
4. No rollback needed — removing `tzdata` from the Dockerfile is the rollback if needed

## Open Questions

None. This is a single-line change with no ambiguity.
