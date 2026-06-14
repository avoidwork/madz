## MODIFIED Requirements

### Requirement: Agent Configuration Defaults
**Reason**: The agent's default recursion limit is being increased from 30 to 1000 to prevent premature stalling during complex tasks.
**Migration**: No migration needed — this is a default value change only. Users with explicit `recursionLimit` in their config are unaffected.
