# memory-loading Specification

## Purpose
TBD - created by archiving change delete-loadmemories-pipeline. Update Purpose after archive.
## Requirements
### Requirement: loadContext is the sole memory loading mechanism
The system SHALL use only `loadContext` from `src/memory/context.js` for loading memory data (profile, clarifications, reflection, and ephemeral entries) into the system prompt.

#### Scenario: loadContext loads all memory
- **WHEN** the application loads the system prompt
- **THEN** `loadContext` is used to load all memory data
- **AND** no other memory loading function is called

