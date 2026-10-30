# Spec Delta

## ADDED Requirements

### Requirement: loadContext reads only the newest ephemeralLimit ephemeral files
The system SHALL, when loading context, read only the newest `ephemeralLimit` ephemeral memory files (ordered by modification time, newest first) from the context directory, excluding expired entries, rather than reading and parsing every ephemeral file.

#### Scenario: Only ephemeralLimit ephemeral files are read
- **WHEN** the context directory contains more than `ephemeralLimit` ephemeral memory files
- **THEN** `loadContext` reads and includes only the newest `ephemeralLimit` files in the context output

#### Scenario: Ephemeral files are ordered newest-first by modification time
- **WHEN** multiple ephemeral memory files exist with different modification times
- **THEN** `loadContext` includes them in the context output ordered newest-first by modification time

#### Scenario: Expired ephemeral files are excluded
- **WHEN** an ephemeral memory file has an `ephemeral_expiresAt` timestamp in the past
- **THEN** `loadContext` excludes that file from the context output
