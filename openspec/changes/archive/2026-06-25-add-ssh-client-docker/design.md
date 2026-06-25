## Context

The madz Docker container currently includes `openssh-server` for accepting inbound SSH connections but lacks `openssh-client`. The harness needs to initiate outbound SSH connections to remote systems for testing, deployment, and remote operations.

## Goals / Non-Goals

**Goals:**
- Add `openssh-client` package to the Docker container
- Provide `ssh`, `scp`, and `sftp` commands within the container
- Maintain consistency with existing package installation patterns

**Non-Goals:**
- SSH key management or configuration
- Multi-stage build refactoring
- SSH server configuration changes
- Image size optimization beyond the package addition

## Decisions

1. **Add to existing `apk add` line rather than creating a separate layer.**
   - Rationale: Keeps the Dockerfile clean, reduces image layers, and follows the existing pattern where all runtime dependencies are installed in a single `RUN` instruction.

2. **No multi-stage build.**
   - Rationale: The marginal image size savings (~1-2 MB) do not justify the added complexity for a development/harness container.

3. **No SSH configuration changes.**
   - Rationale: The harness will continue to use volume mounts for SSH key authentication. The container's existing sshd configuration for inbound connections remains untouched.

## Risks / Trade-offs

- [Risk] Slight increase in Docker image size (~1-2 MB on Alpine) → Mitigation: Negligible in the context of the overall image and development workflow
- [Risk] openssh-client and openssh-server coexistence → Mitigation: They serve independent purposes (client for outbound, server for inbound) and do not conflict

## Migration Plan

No migration required. This is an additive change to the Dockerfile that takes effect on the next container build.

## Open Questions

None.