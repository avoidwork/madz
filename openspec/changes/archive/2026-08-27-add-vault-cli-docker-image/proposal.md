## Why

The agent needs the ability to interact with HashiCorp Vault for secrets management and infrastructure provisioning. Currently, the Docker image does not include the Vault CLI, preventing the agent from reading/writing secrets, managing tokens, or interacting with Vault-backed infrastructure directly.

## What Changes

- Add the `vault` package to the `apk add --no-cache` line in the Dockerfile's runtime stage (line 20)
- No code changes required — this is a pure Dockerfile modification
- No new agent tools or configuration — the CLI is available for the agent to invoke via shell commands

## Capabilities

### New Capabilities
- `vault-cli`: Provides the HashiCorp Vault CLI binary in the Docker image, enabling the agent to execute Vault commands for secrets management, token management, and infrastructure provisioning.

### Modified Capabilities
<!-- None — this is a new capability, not a modification of existing requirements -->

## Impact

- **Dockerfile**: Single-line change to the runtime stage `apk add --no-cache` command
- **Image size**: Increases by approximately 15-20MB
- **No code changes**: No modifications to source code, tools, or agent configuration
- **No breaking changes**: Purely additive — existing functionality is unaffected

## Non-goals

- No Vault integration code or agent tools
- No Vault authentication configuration
- No version pinning of the Vault package
- No changes to the build stage of the Dockerfile
