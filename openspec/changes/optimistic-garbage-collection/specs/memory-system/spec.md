## MODIFIED Requirements

### Requirement: Memory Retention Policy
The system SHALL enforce a configurable retention policy that automatically purges memory files older than a specified duration or beyond a maximum entry count.

#### Scenario: Old memory files are purged
- **WHEN** a memory file exceeds the configured `retention.days` from `config.yaml`
- **THEN** the system removes the file during the next maintenance cycle

#### Scenario: Memory context entries are trimmed by count
- **WHEN** the number of entries in `memory/context/` exceeds `memory.gc.maxContextEntries` (default 100)
- **THEN** the oldest entries are removed during garbage collection, ensuring the count never exceeds the configured maximum
