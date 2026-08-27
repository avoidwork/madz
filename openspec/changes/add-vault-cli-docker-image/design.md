## Context

The madz Docker image is a multi-stage build (amd64, arm64) that installs system dependencies via Alpine's `apk` package manager in the runtime stage. The runtime stage currently installs a comprehensive set of tools (python3, ruby, curl, bash, jq, git, chromium, go, maven, gradle, rust/cargo, etc.) for the agent's tool execution capabilities. The `vault` CLI is not currently included.

The Dockerfile is located at the project root. The runtime stage begins at line 16 (`FROM node:24-alpine`), and system packages are installed at line 20 via a single `apk add --no-cache` command.

## Goals / Non-Goals

**Goals:**
- Add the `vault` package to the Dockerfile's runtime stage `apk add --no-cache` line
- Ensure the binary is accessible in PATH inside the container
- Keep the change minimal — single-line modification only

**Non-Goals:**
- No Vault integration code or agent tools
- No Vault authentication configuration or credential management
- No version pinning of the Vault package
- No changes to the build stage or other Dockerfile sections
- No changes to the docker-entrypoint.sh

## Decisions

### Decision 1: Add `vault` to existing `apk add` line (not a separate line)
- **Rationale**: Keeps the Dockerfile clean and consistent with how other packages are installed. A single `apk add` layer reduces image layer count and is the established pattern in this Dockerfile.
- **Alternatives considered**:
  - Separate `RUN apk add vault` line: Creates an extra layer, less clean
  - Download binary release: More version control but adds complexity and increases image size

### Decision 2: No version pinning
- **Rationale**: Alpine's package manager handles security updates automatically. Pinning would require manual version bumps and could cause the image to lag behind security patches.
- **Alternatives considered**:
  - Pin to specific version (e.g., `vault=1.15.0`): More control but requires manual updates

### Decision 3: No additional Alpine repositories
- **Rationale**: The `vault` package is in Alpine's main repository, so no additional repository configuration is needed.
- **Verification**: Confirmed `vault` is available in Alpine's main repo (not community or testing).

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Alpine's Vault package version may lag behind latest upstream | Acceptable trade-off; Alpine security updates keep it patched. Can be revisited if a specific version is required. |
| Image size increases by ~15-20MB | Documented as acceptable; the image already includes many large tools (chromium, go, maven, gradle, JDK) |
| No Vault integration code means agent needs to know how to use it | The agent's system prompt and tool execution capabilities already support shell commands; Vault usage is a matter of agent knowledge, not code |

## Migration Plan

This is a non-breaking, additive change:
1. Merge the PR to `main`
2. Rebuild the Docker image (handled by release-madz skill or manual `docker build`)
3. No migration steps needed — the binary is available immediately after the image rebuild
4. Rollback: Revert the PR to remove `vault` from the Dockerfile

## Open Questions

- None. This is a straightforward single-line change with no architectural complexity.
