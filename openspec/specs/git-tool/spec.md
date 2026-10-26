# git-tool Specification

## Purpose
TBD - created by archiving change add-git-tool. Update Purpose after archive.
## Requirements
### Requirement: First-class git tool with action-based routing
The system SHALL provide a single `git` tool that wraps common git operations through an `action` parameter. The tool SHALL support the following actions: `status`, `diff`, `log`, `branch`, `add`, `commit`, `push`, `checkout`, `merge`, `rebase`, `stash`, `show`, `tag`.

#### Scenario: Status action returns structured state
- **WHEN** the `git` tool is called with `action: "status"`
- **THEN** the system returns structured JSON with `ok`, `branch`, `changes`, `ahead`, and `behind`

#### Scenario: Diff action returns structured diff
- **WHEN** the `git` tool is called with `action: "diff"`
- **THEN** the system returns structured JSON with `ok`, `files`, `additions`, and `deletions`

#### Scenario: Log action returns commit history
- **WHEN** the `git` tool is called with `action: "log"`
- **THEN** the system returns structured JSON with `ok` and `commits`

#### Scenario: Branch action returns branches
- **WHEN** the `git` tool is called with `action: "branch"`
- **THEN** the system returns structured JSON with `ok`, `branches`, and `current`

#### Scenario: Add action stages files
- **WHEN** the `git` tool is called with `action: "add"` and a `path`
- **THEN** the system stages the file and returns structured JSON with `ok` and `files`

#### Scenario: Commit action creates a commit
- **WHEN** the `git` tool is called with `action: "commit"` and a `message`
- **THEN** the system creates a commit and returns structured JSON with `ok`, `hash`, and `message`

#### Scenario: Push action pushes to remote
- **WHEN** the `git` tool is called with `action: "push"` and a `remote`
- **THEN** the system pushes and returns structured JSON with `ok`, `remote`, and `branch`

#### Scenario: Checkout action switches branches
- **WHEN** the `git` tool is called with `action: "checkout"` and a `branch`
- **THEN** the system switches branches and returns structured JSON with `ok` and `branch`

#### Scenario: Merge action merges a branch
- **WHEN** the `git` tool is called with `action: "merge"` and a `branch`
- **THEN** the system merges and returns structured JSON with `ok` and `branch`

#### Scenario: Rebase action rebases onto a branch
- **WHEN** the `git` tool is called with `action: "rebase"` and a `branch`
- **THEN** the system rebases and returns structured JSON with `ok` and `branch`

#### Scenario: Stash action stashes changes
- **WHEN** the `git` tool is called with `action: "stash"`
- **THEN** the system stashes changes and returns structured JSON with `ok`

#### Scenario: Show action shows a ref
- **WHEN** the `git` tool is called with `action: "show"` and a `ref`
- **THEN** the system shows the ref and returns structured JSON with `ok`, `ref`, and `output`

#### Scenario: Tag action lists tags
- **WHEN** the `git` tool is called with `action: "tag"`
- **THEN** the system lists tags and returns structured JSON with `ok` and `tags`

### Requirement: Input validation via Zod schema
The system SHALL validate all inputs using a Zod schema. The `action` parameter SHALL be restricted to the enum values: `status`, `diff`, `log`, `branch`, `add`, `commit`, `push`, `checkout`, `merge`, `rebase`, `stash`, `show`, `tag`. Action-specific params (`path`, `message`, `branch`, `remote`, `ref`, `force`) SHALL be optional and validated.

#### Scenario: Invalid action rejected
- **WHEN** the `git` tool is called with `action: "invalid"`
- **THEN** the system returns a Zod validation error

#### Scenario: Missing action rejected
- **WHEN** the `git` tool is called without an `action`
- **THEN** the system returns a Zod validation error

### Requirement: Guardrails against destructive operations
The system SHALL enforce a whitelist of safe subcommands and reject destructive operations unless a `force: true` flag is passed and the command is explicitly allowed. Destructive operations (`push --force`, `reset --hard`, `clean -fdx`, `rebase` without explicit opt-in) SHALL be rejected. The system SHALL never pass arbitrary command strings to `sh -c`.

#### Scenario: Push with force rejected without force flag
- **WHEN** the `git` tool is called with `action: "push"` and `force: true` is not set
- **THEN** the system rejects the operation with a structured error

#### Scenario: Rebase rejected without explicit opt-in
- **WHEN** the `git` tool is called with `action: "rebase"` and no explicit opt-in flag
- **THEN** the system rejects the operation with a structured error

#### Scenario: Reset hard rejected
- **WHEN** the `git` tool is called with `action: "reset"` and `--hard`
- **THEN** the system rejects the operation with a structured error

#### Scenario: Clean rejected
- **WHEN** the `git` tool is called with `action: "clean"` and `-fdx`
- **THEN** the system rejects the operation with a structured error

### Requirement: Execution via execFile with arg array
The system SHALL execute git commands using `execFile("git", [args])` so args are passed as an array and never interpreted by a shell. The system SHALL NOT use `spawn("sh", ["-c", command])` or any shell interpolation.

#### Scenario: Args passed as array
- **WHEN** the `git` tool executes any action
- **THEN** the system passes args as an array to `execFile("git", [args])` and never constructs a shell command string

### Requirement: Structured error output
The system SHALL return structured JSON for errors, with `ok: false` and an `error` string, for all failure cases (not a git repo, unknown action, destructive command rejected, git command failure).

#### Scenario: Not a git repo returns error
- **WHEN** the `git` tool is called in a directory that is not a git repository
- **THEN** the system returns `{ ok: false, error }`

#### Scenario: Unknown action returns error
- **WHEN** the `git` tool is called with an unknown action
- **THEN** the system returns `{ ok: false, error }`

#### Scenario: Git command failure returns error
- **WHEN** a git command fails (e.g., branch does not exist)
- **THEN** the system returns `{ ok: false, error }`

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

