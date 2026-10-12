## MODIFIED Requirements

### Requirement: loadContext is the sole memory loading mechanism
The system SHALL use only `loadContext` from `src/memory/context.js` for loading memory data (profile, clarifications, reflection, and ephemeral entries) into the system prompt.

#### Scenario: loadContext loads all memory
- **WHEN** the application loads the system prompt
- **THEN** `loadContext` is used to load all memory data
- **AND** no other memory loading function is called

#### Scenario: loadContext selects files by mtime before reading content
- **WHEN** `loadContext` is called with a context directory containing more `.md` files than `limit`
- **THEN** `loadContext` stats each file to determine `mtime`, sorts newest-first, slices to `limit`, and reads content only for the selected files
- **AND** `loadContext` does not read the full content of files that fall outside the `limit` slice

#### Scenario: loadContext resolves cwd lazily
- **WHEN** `config.cwd` changes at runtime after the module is imported
- **THEN** the next call to `loadContext` resolves the working directory from the current `config.cwd`
- **AND** the stale module-level `cwd` capture is not used
