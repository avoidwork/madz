## Requirements
### Requirement: Config Mutator Tool
The system SHALL provide a dedicated config mutator tool (`src/config/mutate.js`) that deserializes `config.yaml` into a JS object, applies dot-path mutations, validates the patched config against the zod schema, serializes the result back to YAML, and persists it to disk.

#### Scenario: Mutator sets a numeric config value
- **WHEN** a caller invokes `setConfigValueAt(config, "sandbox.timeout.seconds", "60")`
- **THEN** the config object is updated with `{ sandbox: { timeout: { seconds: 60 } } }` and `config.yaml` is rewritten with the new value

#### Scenario: Mutator sets a boolean config value
- **WHEN** a caller invokes `setConfigValueAt(config, "telemetry.enabled", "true")`
- **THEN** the config object is updated with `{ telemetry: { enabled: true } }` and `config.yaml` is rewritten with the new value

#### Scenario: Mutator rejects invalid config via zod
- **WHEN** `setConfigValueAt` is called with a value that violates the zod schema (e.g., `telemetry.enabled` set to `"not-a-boolean"`)
- **THEN** the mutation is rejected, no changes are applied, and an error is thrown

#### Scenario: Mutator creates intermediate objects for deep paths
- **WHEN** a caller invokes `setConfigValueAt(config, "newSection.sub.key", "hello")`
- **THEN** the mutator creates intermediate objects (`newSection`, `sub`) as needed and persists the result

#### Scenario: Mutator preserves existing config sections
- **WHEN** `setConfigValueAt` is called to update a single leaf value (e.g., `memory.retention.days`)
- **THEN** all other config sections remain unchanged in the persisted file

### Requirement: applyDotPath helper for config materialization
The system SHALL provide an `applyDotPath()` helper function that materializes intermediate objects and arrays in a target object given a dot-path and value. This helper is used by `syncEnv()` and is also available for config mutation scenarios.

#### Scenario: applyDotPath creates intermediate objects
- **WHEN** `applyDotPath(obj, "a.b.c", "value")` is called
- **THEN** `obj.a.b.c` equals `"value"` and intermediate objects `a` and `b` are created

#### Scenario: applyDotPath creates arrays for numeric segments
- **WHEN** `applyDotPath(obj, "arr.0", "first")` is called
- **THEN** `obj.arr` is an array with `"first"` at index 0

#### Scenario: applyDotPath fills array gaps with null
- **WHEN** `applyDotPath(obj, "arr.2", "third")` is called on a new object
- **THEN** `obj.arr` is `[null, null, "third"]`

