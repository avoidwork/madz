## Why

The project's skill ecosystem relies heavily on the `gh` CLI for GitHub operations — issue CRUD, PR creation/editing/merging, label management, and raw API calls via the `terminal` tool. Currently, `gh` is not listed in the Dockerfile's `apk add` command, meaning its presence in the container is implicit (installed manually or not at all). Making it an explicit dependency ensures reproducibility and guarantees the binary is present in every build.

## What Changes

- Add `gh` to the `apk add --no-cache` line in the Dockerfile's runtime stage
- No code changes to `src/`, `index.js`, or any skill scripts
- No breaking changes

## Capabilities

### New Capabilities
<!-- No new capabilities — this is a dependency declaration, not a feature -->

### Modified Capabilities
<!-- No spec-level behavior changes — this is purely a build dependency -->

## Impact

- **Dockerfile** — the single file to modify (runtime stage, line 22)
- **Container image** — `gh` binary will be present in every built image
- **Skills** — all skills that invoke `gh` via the `terminal` tool will have a guaranteed dependency
- **No code changes** required in `src/` or `index.js`