## ADDED Requirements

### Requirement: Skill registration from configuration
The system SHALL load and register skills dynamically from configuration files in the `skills/` directory on startup.

#### Scenario: Skill loaded from directory
- **WHEN** a directory exists at `skills/<name>/` with a `config.yaml` definition
- **THEN** the system registers the skill with its input schema, output contract, and permission scope

#### Scenario: Multiple skills loaded
- **WHEN** multiple skill directories exist in `skills/`
- **THEN** the system registers all valid skills and logs any that fail validation

#### Scenario: Invalid skill rejected at load time
- **WHEN** a skill configuration has a missing required field or invalid schema
- **THEN** the system rejects the skill with a descriptive error and continues loading remaining skills

### Requirement: Schema-validated input and output
The system SHALL validate all skill input against the registered zod schema before execution and verify output contracts after execution.

#### Scenario: Invalid input rejected
- **WHEN** a skill is invoked with arguments that do not match its input schema
- **THEN** the system rejects the invocation with a validation error message and does not execute the skill

#### Scenario: Valid input accepted
- **WHEN** a skill is invoked with arguments matching its input schema
- **THEN** the system proceeds to execute the skill

#### Scenario: Output contract verified
- **WHEN** a skill execution completes
- **THEN** the system validates the output against the registered output schema before returning

### Requirement: Permission scoping for skills
The system SHALL enforce a permission model that restricts each skill's access based on its declared capabilities.

#### Scenario: Restricted filesystem access
- **WHEN** a skill with `filesystem: false` attempts to read or write outside mounted volumes
- **THEN** the sandbox intercepts and blocks the operation

#### Scenario: Network access gated
- **WHEN** a skill with `network: false` attempts to make outbound connections
- **THEN** the sandbox network policy prevents the connection

#### Scenario: Permission escalation blocked
- **WHEN** a skill execution attempts to spawn a process not permitted by its scope
- **THEN** the sandbox terminates the process

### Requirement: Dynamic skill discovery and hot-reload
The system SHALL discover new skills at runtime and support hot-reloading without requiring a full application restart.

#### Scenario: New skill detected
- **WHEN** a new skill directory is added to `skills/` while the application is running
- **THEN** a trigger (file watcher or `/reload-skills` command) causes the system to register the new skill

#### Scenario: Modified skill reloaded
- **WHEN** a skill's configuration or script is modified while running
- **THEN** the system re-validates and updates the skill without restarting the TUI

### Requirement: Plugin endpoint for external skills
The system SHALL support registering skills through a plugin endpoint for programmatic and third-party skill registration.

#### Scenario: Runtime plugin registration
- **WHEN** a plugin calls the `registry.register()` API with a valid skill definition
- **THEN** the system validates and registers the plugin skill dynamically

#### Scenario: Plugin skill lifecycle
- **WHEN** a plugin skill is registered and later unregistered via the plugin API
- **THEN** existing invocations complete but the skill is removed from the available skill list
