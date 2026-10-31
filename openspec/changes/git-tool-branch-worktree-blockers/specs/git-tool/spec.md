# Spec Delta

## ADDED Requirements

### Requirement: Worktree add can link to an existing branch

The system SHALL support attaching a worktree to an existing branch via the `worktree add` subcommand. When an `existing` flag is set and a `branch` is provided, the system SHALL emit `git worktree add <path> <branch>` (without `-b`), linking the worktree to the existing branch rather than creating a new one.

#### Scenario: Worktree add links to an existing branch

- **WHEN** the `git` tool is called with `action: "worktree"`, `sub: "add"`, a `path`, a `branch`, and `existing: true`
- **THEN** the system runs `git worktree add <path> <branch>` and returns structured JSON with `ok: true`, `path`, `branch`, and `ref`

### Requirement: Worktree add retains default branch and detach behavior

The system SHALL retain the existing `worktree add` behavior when the `existing` flag is not set. When a `branch` is provided without `existing`, the system SHALL emit `git worktree add -b <branch> <path>`. When neither `branch` nor `existing` is set, the system SHALL emit `git worktree add --detach <path>`.

#### Scenario: Worktree add creates a new branch by default

- **WHEN** the `git` tool is called with `action: "worktree"`, `sub: "add"`, a `path`, and a `branch` without `existing`
- **THEN** the system runs `git worktree add -b <branch> <path>` and returns structured JSON with `ok: true`

#### Scenario: Worktree add detaches by default

- **WHEN** the `git` tool is called with `action: "worktree"`, `sub: "add"`, and a `path` without `branch` or `existing`
- **THEN** the system runs `git worktree add --detach <path>` and returns structured JSON with `ok: true`

### Requirement: Branch delete surfaces a worktree hint

The system SHALL detect the `cannot delete branch ... used by worktree` stderr pattern when deleting a branch and return a structured result identifying the worktree path as the cause, instead of surfacing raw stderr. The result SHALL include the worktree path so the caller can diagnose the conflict.

#### Scenario: Branch delete blocked by a worktree returns a hint

- **WHEN** the `git` tool is called with `action: "branch"`, `delete: true`, and a `branch` that is checked out in a worktree
- **THEN** the system returns `{ ok: false, error: "<message>", worktree: "<path>" }` with the worktree path identified

#### Scenario: Branch delete succeeds normally

- **WHEN** the `git` tool is called with `action: "branch"`, `delete: true`, and a `branch` that is not checked out in any worktree
- **THEN** the system returns `{ ok: true, branch, deleted: true }`

### Requirement: Standalone branch creation with a start ref

The system SHALL support creating a branch via the `branch` action with a `create` flag. When `create` is true, the system SHALL emit `git branch <name> <start-ref>` (with an optional start ref), complementing the `checkout -b` path which cannot take a start ref.

#### Scenario: Branch create with a start ref

- **WHEN** the `git` tool is called with `action: "branch"`, `create: true`, a `branch`, and a `ref`
- **THEN** the system runs `git branch <branch> <ref>` and returns structured JSON with `ok: true` and `branch`

#### Scenario: Branch create without a start ref

- **WHEN** the `git` tool is called with `action: "branch"`, `create: true`, and a `branch` without a `ref`
- **THEN** the system runs `git branch <branch>` and returns structured JSON with `ok: true` and `branch`

### Requirement: Worktree remove surfaces a dirty-worktree hint

The system SHALL detect the dirty-worktree stderr pattern in `worktree remove` and return a structured hint that `--force` is required, instead of surfacing raw stderr.

#### Scenario: Worktree remove on a dirty worktree returns a hint

- **WHEN** the `git` tool is called with `action: "worktree"`, `sub: "remove"`, and a `path` whose worktree contains modified or untracked files without `force`
- **THEN** the system returns a structured result indicating `--force` is required

#### Scenario: Worktree remove succeeds normally

- **WHEN** the `git` tool is called with `action: "worktree"`, `sub: "remove"`, and a `path` whose worktree is clean
- **THEN** the system returns `{ ok: true, path, removed: true }`
