# env-config-materialization Specification

## Purpose
TBD - created by archiving change sync-env-materialize-config. Update Purpose after archive.
## Requirements
### Requirement: Environment variable config materialization
The system SHALL materialize missing config structure from environment variables when the corresponding YAML path does not exist in `config.yaml`, enabling full configuration via environment variables without editing YAML files.

#### Scenario: syncEnv materializes a missing vector project from env vars
- **WHEN** `VECTOR_PROJECTS_MYPROJECT_ROOT_DIR` and `VECTOR_PROJECTS_MYPROJECT_DB_PATH` are set in the environment but `vector.projects.myProject` does not exist in `config.yaml`
- **THEN** `syncEnv()` creates the intermediate objects (`vector`, `projects`, `myProject`) and sets the leaf values, making the project available in the resolved config

#### Scenario: syncEnv materializes array elements from env vars with numeric suffixes
- **WHEN** `VECTOR_PROJECTS_MYPROJECT_INCLUDE_0` through `VECTOR_PROJECTS_MYPROJECT_INCLUDE_2` are set in the environment
- **THEN** `syncEnv()` creates an array at `vector.projects.myProject.include` with the three values at the correct indices

#### Scenario: syncEnv respects prefix allowlist
- **WHEN** an env var like `PATH` or `HOME` is set (not matching any known config section prefix)
- **THEN** `syncEnv()` ignores it and does not materialize any config structure

#### Scenario: syncEnv is idempotent when YAML already has the key
- **WHEN** a config path already exists in the YAML tree (e.g., `providers.openai.credentials.apiKey`)
- **THEN** `syncEnv()` does not override the existing value, even if the corresponding env var is set

#### Scenario: syncEnv handles DROPPED_KEYS containers via schema reverse mapping
- **WHEN** `OPENAI_API_KEY` is set in the environment and `providers.openai` does not exist in YAML
- **THEN** `syncEnv()` materializes the full path `providers.openai.credentials.apiKey`, including the `credentials` container that would be dropped by `_resolveEnvRecursively()`

#### Scenario: syncEnv fills array index gaps with null placeholders
- **WHEN** env vars define array indices 0 and 2 but not 1 (e.g., `VECTOR_PROJECTS_MYPROJECT_INCLUDE_0` and `VECTOR_PROJECTS_MYPROJECT_INCLUDE_2`)
- **THEN** `syncEnv()` creates an array with `null` at index 1 to maintain correct positioning

### Requirement: Schema-driven reverse mapping
The system SHALL introspect Zod schemas to build a reverse mapping from environment variable names to config dot-paths, resolving the ambiguous kebab-case/camelCase conversion.

#### Scenario: Reverse mapping resolves camelCase config keys
- **WHEN** a config path segment is camelCase (e.g., `maxTokens`)
- **THEN** the reverse mapping produces the env-var name `MAX_TOKENS` and maps it back to the correct camelCase path

#### Scenario: Reverse mapping resolves kebab-case config keys
- **WHEN** a config path segment is kebab-case (e.g., `base-url`)
- **THEN** the reverse mapping produces the env-var name `BASE_URL` and maps it back to the correct kebab-case path

### Requirement: applyDotPath helper
The system SHALL provide an `applyDotPath()` function that takes a dot-path and value, and materializes intermediate objects and arrays in a target object.

#### Scenario: applyDotPath creates intermediate objects
- **WHEN** `applyDotPath(obj, "a.b.c", "value")` is called
- **THEN** `obj.a.b.c` equals `"value"` and intermediate objects `a` and `b` are created

#### Scenario: applyDotPath creates arrays for numeric segments
- **WHEN** `applyDotPath(obj, "arr.0", "first")` is called
- **THEN** `obj.arr` is an array with `"first"` at index 0

#### Scenario: applyDotPath fills array gaps with null
- **WHEN** `applyDotPath(obj, "arr.2", "third")` is called on a new object
- **THEN** `obj.arr` is `[null, null, "third"]`

### Requirement: Env-var overrides reach surfaced config keys
The system SHALL resolve environment-variable overrides for the surfaced config keys through the schema-driven reverse map, so that setting an env var materializes the corresponding config path.

#### Scenario: MEMORY_MAX_ENTRIES env var reaches memory.maxEntries
- **WHEN** `MEMORY_MAX_ENTRIES` is set in the environment and `memory.maxEntries` is absent from `config.yaml`
- **THEN** `syncEnv()` materializes `memory.maxEntries` with the env-var value

#### Scenario: CALENDAR_ACTIVE env var reaches calendar.active
- **WHEN** `CALENDAR_ACTIVE` is set in the environment and `calendar.active` is absent from `config.yaml`
- **THEN** `syncEnv()` materializes `calendar.active` with the env-var value

#### Scenario: TUI_STATUS_BAR_PROJECT env var reaches tui.statusBar.project
- **WHEN** `TUI_STATUS_BAR_PROJECT` is set in the environment and `tui.statusBar.project` is absent from `config.yaml`
- **THEN** `syncEnv()` materializes `tui.statusBar.project` with the env-var value

#### Scenario: SCHEDULES_LOG_PATH env var reaches schedules.logPath
- **WHEN** `SCHEDULES_LOG_PATH` is set in the environment and `schedules.logPath` is absent from `config.yaml`
- **THEN** `syncEnv()` materializes `schedules.logPath` with the env-var value

