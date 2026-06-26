## Context

The project's Docker image is built from a multi-stage Dockerfile. The runtime stage (second FROM) installs system dependencies via `apk add --no-cache` on line 22. The `gh` CLI is not currently listed, meaning its presence in the container is implicit — it may be installed manually during development or not at all.

The skill ecosystem relies on `gh` for:
- Issue CRUD operations
- PR creation, editing, and merging
- Label management
- Raw `gh api` calls

All of these execute `gh` as a shell command via the `terminal` tool.

## Goals / Non-Goals

**Goals:**
- Add `gh` to the `apk add` line in the Dockerfile's runtime stage
- Ensure `gh` is present in every built container image
- Maintain alphabetical ordering convention

**Non-Goals:**
- No code changes to `src/`, `index.js`, or skill scripts
- No version pinning (following existing convention)
- No documentation updates
- No changes to the builder stage

## Decisions

1. **Add `gh` to existing `apk add` line** — Rather than creating a separate `RUN apk add gh` layer, append `gh` to the existing line. This keeps the Dockerfile clean and minimizes image layers.

2. **Alphabetical placement** — Insert `gh` in alphabetical order among existing packages. It goes between `git` and `file` (alphabetically: `gh` < `git` < `file`... actually `gh` comes before `git` since `h` < `i`). So the order is: `...ca-certificates gh git file...`.

3. **No version pinning** — Follow the existing pattern in the Dockerfile where packages are not version-pinned. This is consistent with the project's approach.

4. **No additional repos** — `gh` is available in the main Alpine repository, so no additional repos or GPG keys are required.

## Risks / Trade-offs

- **Image size:** Adding `gh` increases the image by approximately 10-15 MB (compressed). This is negligible for the project's use case.
- **Build time:** No meaningful impact on build time.
- **Alpine availability:** `gh` is in the main Alpine repo, so no risk of missing packages.

## Migration Plan

This is a non-breaking change. No migration steps are required. The Docker image will simply include `gh` in future builds.

## Open Questions

None.