# Spec Delta

## MODIFIED Requirements

### Requirement: Tool discovers AGENTS.md in specified path
The scanAgents tool SHALL accept an optional `path` parameter and check for the
existence of an `AGENTS.md` file at that location. If no path is provided, the
tool SHALL resolve the default against the active project working directory
(`getProjectCwd()`), falling back to `config.cwd` and then `process.cwd()`. The
active project context SHALL be consulted at call time, not captured once at
module load.

#### Scenario: Scan current working directory
- **WHEN** the tool is called with no arguments
- **THEN** the tool checks for `AGENTS.md` in the active project working
  directory, falling back to `config.cwd` and then `process.cwd()`

#### Scenario: Scan active project when no path is provided
- **WHEN** the tool is called with no arguments and a project context is active
- **THEN** the tool checks for `AGENTS.md` in the active project working directory

#### Scenario: Fall back to config.cwd when no project is active
- **WHEN** the tool is called with no arguments and no project context is active
- **THEN** the tool checks for `AGENTS.md` in `config.cwd`

#### Scenario: Fall back to process.cwd when no project and no config.cwd
- **WHEN** the tool is called with no arguments, no project context is active, and
  `config.cwd` is unset
- **THEN** the tool checks for `AGENTS.md` in `process.cwd()`

#### Scenario: Scan specified path
- **WHEN** the tool is called with a `path` parameter
- **THEN** the tool checks for `AGENTS.md` in the specified directory
