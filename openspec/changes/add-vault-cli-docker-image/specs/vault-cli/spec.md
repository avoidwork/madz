# vault-cli Specification

## Purpose
Define the requirement that the HashiCorp Vault CLI (`vault`) is available in the Docker image for agent use in secrets management and infrastructure provisioning.

## Requirements

### Requirement: Vault CLI must be installed in the container image
The Dockerfile SHALL include `vault` in the `apk add --no-cache` command in the runtime stage, ensuring the Vault CLI binary is present in every built container image.

#### Scenario: vault is in the Dockerfile package list
- **WHEN** the Dockerfile runtime stage is parsed
- **THEN** `vault` appears in the `apk add --no-cache` command

#### Scenario: vault is available in the container
- **WHEN** the container is built and started
- **THEN** `vault --version` executes successfully without "command not found"

#### Scenario: vault binary is in PATH
- **WHEN** the container is running
- **THEN** `which vault` returns a valid path (e.g., `/usr/bin/vault`)

#### Scenario: vault has no missing shared libraries
- **WHEN** the container is running
- **THEN** `ldd $(which vault)` reports no "not found" entries
