## ADDED Requirements

### Requirement: Sampling tool captures high-intensity moments
The system SHALL provide a `sampling` tool that writes ephemeral memories to `memory/context/` for high-intensity emotional moments (joy, sadness, grief) or strong reinforcement from previously loaded memories.

#### Scenario: Sampling writes an ephemeral memory file
- **WHEN** the sampling tool is invoked with a `content` input
- **THEN** a markdown file is created in `memory/context/` with YAML frontmatter containing `title`, `timestamp`, `ephemeral: true`, and `ephemeral_expiresAt` fields, plus the content as the body

#### Scenario: Sampling rejects empty content
- **WHEN** the sampling tool is called without a content value
- **THEN** it returns an error indicating content is required

#### Scenario: Sampling file includes expiration timestamp
- **WHEN** the sampling tool writes a file
- **THEN** the frontmatter contains `ephemeral_expiresAt` set to the file's creation date plus `memory.ephemeral.ttlDays` rounded up to the next midnight

### Requirement: Ephemeral memory rate limiting per session
The sampling tool SHALL enforce a cooldown period of 60 minutes between writes, preventing more than one ephemeral memory from being written within any 60-minute window.

#### Scenario: Sampling rejects writes within cooldown period
- **WHEN** the sampling tool is called a second time within 60 minutes of a previous sampling write
- **THEN** it returns an error indicating the cooldown period is active and includes the time remaining

#### Scenario: Sampling succeeds after cooldown expires
- **WHEN** the sampling tool is called more than 60 minutes after the previous sampling write
- **THEN** it successfully writes the ephemeral memory

### Requirement: Ephemeral memory capacity limit
The system SHALL enforce a maximum number of concurrent ephemeral memories, configurable via `memory.ephemeral.maxEntries` (default 10).

#### Scenario: Sampling rejects writes when at capacity
- **WHEN** the number of expired-free ephemeral memory files in `memory/context/` equals `memory.ephemeral.maxEntries`
- **THEN** the sampling tool returns an error indicating the capacity limit has been reached

#### Scenario: Capacity is checked excluding expired files
- **WHEN** the capacity limit is active but some ephemeral files are expired
- **THEN** only non-expired files are counted toward the limit

### Requirement: Session-init cleanup of expired ephemeral memories
The system SHALL asynchronously clean up expired ephemeral memory files at session initialization, before the agent becomes responsive.

#### Scenario: Expired ephemeral files are deleted at session init
- **WHEN** a new session starts
- **THEN** all ephemeral memory files with `ephemeral_expiresAt` before the current time are deleted from `memory/context/`

#### Scenario: Non-expired ephemeral files are preserved at session init
- **WHEN** a new session starts and some ephemeral files are not yet expired
- **THEN** those files remain in `memory/context/`

#### Scenario: Non-ephemeral context files are preserved at session init
- **WHEN** a new session starts and `memory/context/` contains both ephemeral and non-ephemeral files
- **THEN** only ephemeral files are subject to cleanup; non-ephemeral files are untouched

#### Scenario: Cleanup runs without blocking session init
- **WHEN** a new session starts
- **THEN** the agent becomes responsive before cleanup completes, using non-blocking async execution

#### Scenario: Cleanup handles missing directory gracefully
- **WHEN** `memory/context/` does not exist at session init
- **THEN** cleanup completes without error and the session initializes normally

### Requirement: Ephemeral memory TTL and capacity are configurable
The system SHALL allow configuration of ephemeral memory TTL (in days) and maximum concurrent entries via `config.yaml` under the `memory.ephemeral` section.

#### Scenario: Config provides default TTL of 7 days
- **WHEN** no `memory.ephemeral` section is present in `config.yaml`
- **THEN** the TTL defaults to 7 days

#### Scenario: Config provides default maxEntries of 10
- **WHEN** no `memory.ephemeral` section is present in `config.yaml`
- **THEN** the max concurrent ephemeral entries defaults to 10

#### Scenario: Config overrides TTL value
- **WHEN** `memory.ephemeral.ttlDays` is set to a positive integer in `config.yaml`
- **THEN** the sampling tool uses that value for expiration calculation

#### Scenario: Config overrides maxEntries value
- **WHEN** `memory.ephemeral.maxEntries` is set to a positive integer in `config.yaml`
- **THEN** the sampling tool uses that value as the capacity limit
