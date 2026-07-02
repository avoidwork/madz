## MODIFIED Requirements

### Requirement: Compaction integrated into Deep Agents flow
The system SHALL integrate context compaction into the Deep Agents flow instead of separate handling.

#### Scenario: Compaction triggers during agent execution
- **WHEN** the context window approaches capacity during Deep Agents execution
- **THEN** compaction is triggered as part of the Deep Agents flow

#### Scenario: Compaction event is emitted
- **WHEN** compaction occurs during Deep Agents execution
- **THEN** a compaction_start and compaction_end event is emitted to the streaming callback