## ADDED Requirements

### Requirement: Skill Discovery
The system SHALL automatically discover all skills in the `skills/` directory by scanning for subdirectories and loading their metadata from a `skill.yaml` or `skill.json` file within each skill root.

#### Scenario: System discovers a new skill directory
- **WHEN** a new directory is added to `skills/` containing a valid `skill.yaml` file
- **THEN** the registry registers the skill and makes it available for invocation on the next discovery cycle

#### Scenario: System ignores invalid skill directories
- **WHEN** a directory in `skills/` lacks a `skill.yaml` or `skill.json` file
- **THEN** the system skips the directory and logs a warning at the debug level

### Requirement: Schema Validation
The system SHALL validate each skill's input schema against a zod-like schema definition before activation and reject skills with invalid or missing schemas.

#### Scenario: Skill with valid schema is activated
- **WHEN** a skill defines a valid `inputSchema` in its metadata
- **THEN** the system validates the schema at registry load time and activates the skill

#### Scenario: Skill with invalid schema is rejected
- **WHEN** a skill's `inputSchema` fails validation
- **THEN** the system skips activation of the skill and logs the validation error

### Requirement: Input/Output Contracts
Every registered skill SHALL expose a defined input schema, a defined output schema, and a clear execution context specifying resource access boundaries.

#### Scenario: Tool invocation passes validated input to skill
- **WHEN** the harness invokes a skill
- **THEN** the input is validated against the skill's input schema before execution

#### Scenario: Skill output conforms to declared output schema
- **WHEN** a skill completes execution
- **THEN** the output is validated against the skill's output schema and an error is raised if it does not match

### Requirement: Permission Scoping
Each registered skill SHALL declare the permission scopes it requires (e.g., `filesystem:read`, `network:outbound`, `process:spawn`), and the harness SHALL enforce these scopes during execution.

#### Scenario: Skill declares required permissions
- **WHEN** a skill's metadata specifies a `permissions` array
- **THEN** the system grants those scopes to the sandbox during execution

#### Scenario: Skill runs without declared permissions
- **WHEN** a skill does not declare permissions in its metadata
- **THEN** the system grants only the default read-only filesystem scope
