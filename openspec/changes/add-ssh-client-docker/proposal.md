## Why

The harness needs to initiate SSH connections to remote systems for testing, deployment, and remote operations. Currently, the Docker container includes `openssh-server` (for accepting inbound connections) but lacks `openssh-client`, which prevents the harness from making outbound SSH connections to other systems.

## What Changes

- Add `openssh-client` package to the Dockerfile's `apk add --no-cache` line alongside the existing `openssh-server` package
- This provides `ssh`, `scp`, and `sftp` commands within the container
- No configuration changes — the harness will continue to use volume mounts for SSH key authentication

## Capabilities

### New Capabilities
- `ssh-client`: Enables outbound SSH, SCP, and SFTP connections from the Docker container to remote systems

### Modified Capabilities
<!-- None — no existing spec-level requirements are changing -->

## Impact

- **Dockerfile** — single-line modification to the `apk add` command (line ~18)
- **Docker image** — increases image size by ~1-2 MB (Alpine)
- **No API or code changes** — purely an infrastructure/package addition
- **No breaking changes** — additive only