## MODIFIED Requirements

### Requirement: Working directory resolution from active project cwd
The system SHALL resolve the process tool's working directory from the active project cwd via `getProjectCwd()` from `src/workspace/project.js` when spawning commands. The resolution order SHALL be `getProjectCwd() || config.cwd || process.cwd()`. This applies to both foreground and background spawns.

#### Scenario: process pwd resolves to the active project cwd
- **WHEN** the active project cwd is set via `setProjectCwd()` and the `process` tool is called with `action: "start"` and `command: "pwd"`
- **THEN** the system runs the command in the active project cwd and the output reflects that directory

#### Scenario: Background process resolves to the active project cwd
- **WHEN** the active project cwd is set via `setProjectCwd()` and the `process` tool is called with `action: "start"`, `command: "pwd"`, and `background: true`
- **THEN** the system runs the background command in the active project cwd

#### Scenario: Falls back to config.cwd when no project is active
- **WHEN** no project is active (`getProjectCwd()` returns `""`) and the `process` tool is called with `action: "start"` and `command: "pwd"`
- **THEN** the system runs the command in `config.cwd` (or `process.cwd()` if `config.cwd` is unset)
