## ADDED Requirements

### Requirement: gh CLI must be installed in the container image
The Dockerfile SHALL include `gh` in the `apk add --no-cache` command in the runtime stage, ensuring the GitHub CLI binary is present in every built container image.

#### Scenario: gh is in the Dockerfile package list
- **WHEN** the Dockerfile runtime stage is parsed
- **THEN** `gh` appears in the `apk add --no-cache` command

#### Scenario: gh is available in the container
- **WHEN** the container is built and started
- **THEN** `gh --version` executes successfully without "command not found"