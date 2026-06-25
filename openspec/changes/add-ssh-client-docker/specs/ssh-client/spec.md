## ADDED Requirements

### Requirement: Container includes SSH client
The Docker container MUST include the `openssh-client` package to provide outbound SSH capabilities.

#### Scenario: SSH client is available
- **WHEN** the Docker container is built
- **THEN** the `ssh` command is available in the container PATH

#### Scenario: SCP is available
- **WHEN** the Docker container is built
- **THEN** the `scp` command is available in the container PATH

#### Scenario: SFTP is available
- **WHEN** the Docker container is built
- **THEN** the `sftp` command is available in the container PATH

### Requirement: SSH client installed via apk
The `openssh-client` package MUST be installed via `apk add --no-cache` alongside existing packages in the Dockerfile.

#### Scenario: Package installed in single layer
- **WHEN** the Dockerfile is built
- **THEN** `openssh-client` is installed in the same `RUN` instruction as other runtime dependencies