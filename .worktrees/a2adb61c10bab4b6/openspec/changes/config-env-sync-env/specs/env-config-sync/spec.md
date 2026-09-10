## ADDED Requirements

### Requirement: syncEnv materializes missing config structure from environment variables
The system SHALL scan `process.env` for keys matching known config section prefixes and materialize any missing config structure (objects, arrays) into the raw config object before recursive env resolution.

#### Scenario: Env var defines a new top-level section
- **WHEN** `process.env` contains `VECTOR_MODEL=openai` and the YAML config has no `vector` section
- **THEN** `syncEnv()` SHALL create `raw.vector.model = "openai"` in the raw config object

#### Scenario: Env var defines a nested path with intermediate objects
- **WHEN** `process.env` contains `OPENAI_API_KEY=sk-abc123` and the YAML config has no `providers.openai.credentials` section
- **THEN** `syncEnv()` SHALL materialize `raw.providers.openai.credentials.apiKey = "sk-abc123"`, creating intermediate objects as needed

#### Scenario: Env var with numeric suffix creates an array
- **WHEN** `process.env` contains `VECTOR_PROJECTS_PROJECT_ALPHA_INCLUDE_0=src/**/*.js` and `VECTOR_PROJECTS_PROJECT_ALPHA_INCLUDE_1=src/**/*.mjs`
- **THEN** `syncEnv()` SHALL create `raw.vector.projects["project-alpha"].include` as an array with two elements

#### Scenario: Idempotent when YAML already has the key
- **WHEN** the YAML config already defines `providers.openai.model = "gpt-4"` and `process.env` also contains `OPENAI_MODEL=gpt-4o`
- **THEN** `syncEnv()` SHALL NOT override the existing YAML value

### Requirement: Prefix allowlist prevents system env vars from leaking
The system SHALL only consider env vars whose top-level segment matches a known config section prefix.

#### Scenario: Unknown prefix is ignored
- **WHEN** `process.env` contains `PATH=/usr/bin` or `HOME=/root`
- **THEN** `syncEnv()` SHALL NOT materialize any config structure from these env vars

#### Scenario: Known prefix is processed
- **WHEN** `process.env` contains `SANDBOX_TIMEOUT_SECONDS=60`
- **THEN** `syncEnv()` SHALL process this env var because `sandbox` is a known section

### Requirement: Schema-driven reverse mapping resolves kebab-case/camelCase ambiguity
The system SHALL use Zod schema introspection to build a reverse lookup map from env-var names to config dot-paths.

#### Scenario: Reverse mapping for a simple path
- **WHEN** the Zod schema defines `providers.openai.credentials.apiKey`
- **THEN** the reverse map SHALL contain an entry mapping `OPENAI_API_KEY` to `providers.openai.credentials.apiKey`

#### Scenario: Reverse mapping for a path with kebab-case
- **WHEN** the Zod schema defines `vector.projects["project-alpha"].rootDir`
- **THEN** the reverse map SHALL contain an entry mapping `VECTOR_PROJECTS_PROJECT_ALPHA_ROOT_DIR` to `vector.projects.project-alpha.rootDir`

### Requirement: DROPPED_KEYS dead entry fix
The `"subAgentsTemperature"` entry in DROPPED_KEYS SHALL be changed to lowercase `"subagentstemperature"` so the filter correctly matches path segments.

#### Scenario: subAgentsTemperature path segment is filtered
- **WHEN** `_resolveEnvRecursively()` processes a path containing `subAgentsTemperature`
- **THEN** the `subAgentsTemperature` segment SHALL be dropped from the env-var name (e.g., `subAgentsTemperature.coding` → `SUB_AGENTS_TEMPERATURE_CODING` without the fix, but after the fix the segment is dropped and the path becomes `CODING`)

### Requirement: applyDotPath helper materializes intermediate objects and arrays
The system SHALL provide an `applyDotPath()` function that takes a dot-path and value, and materializes intermediate objects/arrays in the target object.

#### Scenario: Simple object path
- **WHEN** `applyDotPath(raw, "a.b.c", "value")` is called
- **THEN** `raw.a.b.c` SHALL equal `"value"` and intermediate objects `a` and `b` SHALL be created

#### Scenario: Numeric segment creates array
- **WHEN** `applyDotPath(raw, "a.0", "first")` and `applyDotPath(raw, "a.1", "second")` are called
- **THEN** `raw.a` SHALL be an array `["first", "second"]`

#### Scenario: Mixed numeric and string segments
- **WHEN** `applyDotPath(raw, "projects.project-alpha.include.0", "src/**/*.js")` is called
- **THEN** `raw.projects["project-alpha"].include[0]` SHALL equal `"src/**/*.js"`
