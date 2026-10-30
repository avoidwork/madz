# ephemeral-memory Specification

## Purpose
Defines the lifecycle of ephemeral memory entries in `memory/context/` — how they are marked, how expiry is determined, and how expired entries are removed on session init.

## Requirements

### Requirement: Expired ephemeral memories are removed on session init
The system SHALL remove ephemeral memory files in the context directory whose `ephemeral_expiresAt` timestamp is in the past when the session initializes.

#### Scenario: Expired ephemeral file is deleted
- **WHEN** the session initializes
- **AND** an ephemeral memory file in the context directory has an `ephemeral_expiresAt` timestamp in the past
- **THEN** the file is deleted from the context directory

#### Scenario: Non-expired ephemeral file is retained
- **WHEN** the session initializes
- **AND** an ephemeral memory file in the context directory has an `ephemeral_expiresAt` timestamp in the future
- **THEN** the file is retained in the context directory

#### Scenario: Non-ephemeral file is retained
- **WHEN** the session initializes
- **AND** a file in the context directory is not marked as ephemeral
- **THEN** the file is retained in the context directory

### Requirement: Context directory path resolution tolerates absolute and relative paths
The system SHALL resolve the context directory correctly whether it is supplied as an absolute path or a relative path, so that expired ephemeral files are deleted regardless of how the caller passes the directory.

#### Scenario: Absolute context directory path resolves correctly
- **WHEN** the context directory is supplied as an absolute path
- **THEN** the system scans and deletes expired ephemeral files in that directory

#### Scenario: Relative context directory path resolves correctly
- **WHEN** the context directory is supplied as a relative path
- **THEN** the system scans and deletes expired ephemeral files in that directory

#### Scenario: Missing context directory is handled gracefully
- **WHEN** the context directory does not exist
- **THEN** the system returns zero removed files without throwing
