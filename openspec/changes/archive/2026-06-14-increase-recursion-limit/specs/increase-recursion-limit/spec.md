## ADDED Requirements

### Requirement: Agent configuration default recursion limit
The system SHALL use a default recursion limit of 1000 steps for the agent graph, up from 30, to prevent premature stalling during complex multi-step tasks.

**Reason**: The previous default of 30 was insufficient for tool-using agents performing complex tasks with multiple tool calls and context compaction.

**Migration**: No migration needed — this is a default value change only. Users with explicit `recursionLimit` in their config are unaffected.

#### Scenario: Default recursion limit is 1000
- **WHEN** no `recursionLimit` is set in config
- **THEN** the agent graph uses a default limit of 1000 steps

#### Scenario: Custom recursionLimit is respected
- **WHEN** `recursionLimit` is explicitly set in config (e.g., to 500)
- **THEN** the agent graph uses the configured value instead of the default
