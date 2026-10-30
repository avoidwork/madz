# Spec Delta

## MODIFIED Requirements

### Requirement: Sampling tool captures high-intensity moments
The system SHALL provide a `sampling` tool that writes ephemeral memories to `memory/context/` for high-intensity emotional moments (joy, sadness, grief) or strong reinforcement from previously loaded memories. The tool SHALL return a native structured object: `{ ok: true, message, createdAt, expiresAt, path }` on success and `{ ok: false, error }` on failure.

#### Scenario: Sampling writes an ephemeral memory file
- **WHEN** the sampling tool is invoked with a `content` input
- **THEN** a markdown file is created in `memory/context/` with YAML frontmatter containing `title`, `timestamp`, `ephemeral: true`, and `ephemeral_expiresAt` fields, plus the content as the body, and the tool returns a native object `{ ok: true, message, createdAt, expiresAt, path }`

#### Scenario: Sampling rejects empty content
- **WHEN** the sampling tool is called without a content value
- **THEN** it returns a native object `{ ok: false, error }` where the error indicates content is required

#### Scenario: Sampling file includes expiration timestamp
- **WHEN** the sampling tool writes a file
- **THEN** the frontmatter contains `ephemeral_expiresAt` set to the file's creation date plus `memory.ephemeral.ttlDays` rounded up to the next midnight

### Requirement: Ephemeral memory rate limiting per session
The sampling tool SHALL enforce a cooldown period of 60 minutes between writes, preventing more than one ephemeral memory from being written within any 60-minute window.

#### Scenario: Sampling rejects writes within cooldown period
- **WHEN** the sampling tool is called a second time within 60 minutes of a previous sampling write
- **THEN** it returns a native object `{ ok: false, error }` where the error indicates the cooldown period is active and includes the time remaining

#### Scenario: Sampling succeeds after cooldown expires
- **WHEN** the sampling tool is called more than 60 minutes after the previous sampling write
- **THEN** it successfully writes the ephemeral memory and returns a native object `{ ok: true, ... }`

### Requirement: Ephemeral memory capacity limit
The system SHALL enforce a maximum number of concurrent ephemeral memories, configurable via `memory.ephemeral.maxEntries` (default 10).

#### Scenario: Sampling rejects writes when at capacity
- **WHEN** the number of expired-free ephemeral memory files in `memory/context/` equals `memory.ephemeral.maxEntries`
- **THEN** the sampling tool returns a native object `{ ok: false, error }` where the error indicates the capacity limit has been reached

#### Scenario: Capacity is checked excluding expired files
- **WHEN** the capacity limit is active but some ephemeral files are expired
- **THEN** only non-expired files are counted toward the limit
