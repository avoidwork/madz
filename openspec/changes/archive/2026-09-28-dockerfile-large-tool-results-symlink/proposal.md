## Why

The `deepagents` module hardcodes `/large_tool_results` as the artifacts root where it offloads large tool results (e.g., file reads, code search output). On the default overlay filesystem, writes to this path consume the container's writable layer, which is ephemeral and can grow unbounded. Linking `/large_tool_results` to `/tmp` keeps large artifacts out of the writable layer and reduces disk pressure.

## What Changes

- Add `RUN ln -s /tmp /large_tool_results` to the Dockerfile runtime stage (the second `FROM node:26-slim` block), after the permissions block (`RUN chown -R madz:node /app /home/madz`).
- This is a Dockerfile-only change — no JS source code changes, no new npm dependencies, no runtime configuration.

## Capabilities

### New Capabilities
- `dockerfile-large-tool-results-symlink`: The Dockerfile runtime stage SHALL create a symlink so `/large_tool_results` resolves to `/tmp`, keeping large tool outputs off the container's writable layer.

### Modified Capabilities
<!-- No existing spec-level behavior changes. -->

## Impact

- **File**: `Dockerfile` — the runtime stage (second `FROM node:26-slim`). The symlink is added after the permissions block.
- **Reference (not modified)**: `node_modules/deepagents/dist/langsmith-3LzYb-m7.js` — hardcoded `/large_tool_results` artifacts root (line 2662 writes `/large_tool_results/<tool_call_id>.txt`). Not configurable from madz's own config, so the Dockerfile symlink is the correct seam.
- **No dependencies**: This uses the standard `ln -s` command. No new npm packages or system dependencies.

## Non-goals

- No changes to the builder stage.
- No changes to `docker-entrypoint.sh`.
- No runtime volume/tmpfs mount configuration.
- No JS source code changes.
