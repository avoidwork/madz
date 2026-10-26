## MODIFIED Requirements

### Requirement: Working directory resolution from active project cwd
The system SHALL resolve the git tool's working directory from the active project cwd via `getProjectCwd()` from `src/workspace/project.js` when no explicit `options.cwd` is provided. The resolution order SHALL be `options.cwd || getProjectCwd() || config.cwd || process.cwd()`. The `path` parameter SHALL remain a pathspec and SHALL NOT change the run directory.

#### Scenario: git status succeeds against the selected project
- **WHEN** the active project cwd is set to a git repository via `setProjectCwd()` and the `git` tool is called with `action: "status"` and no `path`
- **THEN** the system runs git in the active project cwd and returns `{ ok: true, branch, changes, ahead, behind }`

#### Scenario: Explicit options.cwd overrides the project cwd
- **WHEN** the `git` tool is called with `action: "status"` and an explicit `options.cwd` pointing to a different directory
- **THEN** the system runs git in the explicit `options.cwd` directory

#### Scenario: Falls back to config.cwd when no project is active
- **WHEN** no project is active (`getProjectCwd()` returns `""`) and the `git` tool is called with `action: "status"`
- **THEN** the system runs git in `config.cwd` (or `process.cwd()` if `config.cwd` is unset)
