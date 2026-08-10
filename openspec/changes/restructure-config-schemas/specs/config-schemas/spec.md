## ADDED Requirement: Modular schema files

The system SHALL split the monolithic `src/config/schemas.js` into per-section files under `src/config/schemas/`, with each file containing schemas for a single config section.

### Requirement: Schema re-export compatibility

The system SHALL provide `src/config/schemas/index.js` that re-exports all schemas, maintaining backward compatibility with existing import paths.

#### Scenario: Existing imports continue to work
- **WHEN** a file imports from `src/config/schemas.js` or `../schemas.js`
- **THEN** the import resolves correctly via the index.js re-exports

#### Scenario: All schemas are accessible
- **WHEN** importing from `src/config/schemas/`
- **THEN** all previously exported schemas (providers, sandbox, memory, telemetry, schedules, tui, agent, lru, persistence) are available

### Requirement: DEFAULT_CONFIG evaluation

The system SHALL audit all consumers of `DEFAULT_CONFIG` and determine whether it can be removed or must be preserved.

#### Scenario: DEFAULT_CONFIG is redundant
- **WHEN** all Zod `.default()` values match DEFAULT_CONFIG values
- **THEN** DEFAULT_CONFIG is removed from the codebase

#### Scenario: DEFAULT_CONFIG is needed
- **WHEN** any consumer relies on DEFAULT_CONFIG as a plain object
- **THEN** DEFAULT_CONFIG is preserved and documented

### Requirement: mutate.js rename

The system SHALL rename `src/config/mutate.js` to `src/config/patch.js` and update all import paths.

#### Scenario: No broken imports
- **WHEN** all files that imported from `mutate.js` are updated
- **THEN** no import errors occur and all functionality is preserved

#### Scenario: No remaining references
- **WHEN** the codebase is searched for `mutate`
- **THEN** no references to `mutate.js` remain (only `patch.js`)
