## Context

The `deepagents` module hardcodes `/large_tool_results` as the artifacts root where it offloads large tool results (e.g., file reads, code search output). See `node_modules/deepagents/dist/langsmith-3LzYb-m7.js` line 2662, which writes `/large_tool_results/<tool_call_id>.txt`. This path is not configurable from madz's own config, so the correct seam is a symlink baked into the Docker image.

On the default overlay filesystem, writes to `/large_tool_results` consume the container's writable layer, which is ephemeral and can grow unbounded. Linking `/large_tool_results` to `/tmp` keeps large artifacts out of the writable layer and reduces disk pressure.

## Goals / Non-Goals

**Goals:**
- Add `RUN ln -s /tmp /large_tool_results` to the Dockerfile runtime stage (the second `FROM node:26-slim` block), after the permissions block (`RUN chown -R madz:node /app /home/madz`).
- Ensure the symlink exists before the application starts so writes to `/large_tool_results` land in `/tmp`.
- Keep the change Dockerfile-only — no JS source changes, no new npm dependencies.

**Non-Goals:**
- No changes to the builder stage.
- No changes to `docker-entrypoint.sh`.
- No runtime volume/tmpfs mount configuration.
- No JS source code changes.

## Decisions

**Decision: Use a symlink baked into the image rather than a runtime volume/tmpfs mount.**

- **Symlink (`RUN ln -s /tmp /large_tool_results`)** — baked into the image, requires no runtime configuration. `/tmp` is already writable by the `madz` user, so no additional chown is needed for the symlink target.
- **Volume mount at `/large_tool_results`** — requires runtime configuration, not baked into the image.
- **tmpfs mount** — requires runtime flags.

The symlink approach is the correct seam because `/large_tool_results` is hardcoded in a dependency and not configurable from madz's own config.

**Decision: Place the symlink after the permissions block.**

The symlink must be created after `RUN chown -R madz:node /app /home/madz` so the path exists before the application starts. `/tmp` is already writable by the `madz` user, so no additional chown is needed for the symlink target.

## Risks / Trade-offs

- **[Symlink target permissions]** → `/tmp` is already writable by the `madz` user, so no additional chown is needed. Standard container `/tmp` permissions apply.
- **[Symlink is static and container-internal]** → No external exposure. The path is a static, container-internal path with no external exposure.
- **[Symlink survives container restart]** → The symlink is baked into the image, so it persists across container restarts.
