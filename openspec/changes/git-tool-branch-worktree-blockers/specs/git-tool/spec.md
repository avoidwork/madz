# Spec Delta

## ADDED Requirements

### Requirement: Worktree can attach to an existing branch

The system SHALL support attaching a worktree to a branch that already exists via the `worktree add` action with an `existing` flag. When `existing` is true, the system SHALL invoke `git worktree add <path> <branch>` (without `-b` and without `--detach`). When `existing` is false and a `branch` is provided, the system SHALL invoke `git worktree add -b <branch> <path>` to create a new branch. When neither `branch` nor `existing` is set, the system SHALL invoke `git worktree add --detach <path>`.

#### Scenario: Attach worktree to existing branch

- **WHEN** the `worktree add` action is invoked with `existing: true` and a `branch` that already exists
- **THEN** the system invokes `git worktree add <path> <branch>` and the worktree is attached to that branch

#### Scenario: Create worktree on new branch

- **WHEN** the `worktree add` action is invoked with a `branch` that does not exist and `existing` is false
- **THEN** the system invokes `git worktree add -b <branch> <path>` and creates a new branch

#### Scenario: Detached worktree

- **WHEN** the `worktree add` action is invoked with neither `branch` nor `existing`
- **THEN** the system invokes `git worktree add --detach <path>`

### Requirement: Branch delete surfaces worktree conflict

The system SHALL detect the `cannot delete branch ... used by worktree` error from `git branch -d`/`-D` and return a structured result identifying the worktree path as the cause, rather than surfacing only the raw stderr.

#### Scenario: Delete branch used by worktree

- **WHEN** the `branch` delete action is invoked on a branch that is checked out in a worktree
- **THEN** the system returns `ok: false` with an error message and the worktree path identified as the cause

### Requirement: Standalone branch creation

The system SHALL support creating a branch without checking it out via the `branch` action with a `create` flag. When `create` is true, the system SHALL invoke `git branch <name> [<start-ref>]`, optionally creating the branch from a provided start ref.

#### Scenario: Create branch without checkout

- **WHEN** the `branch` action is invoked with `create: true` and a `branch` name
- **THEN** the system invokes `git branch <name>` and creates the branch without switching to it

#### Scenario: Create branch from start ref

- **WHEN** the `branch` action is invoked with `create: true`, a `branch` name, and a `ref`
- **THEN** the system invokes `git branch <name> <ref>` and creates the branch from that ref

### Requirement: Worktree remove surfaces dirty state

The system SHALL detect the `contains modified or untracked files` error from `git worktree remove` and return a structured result indicating that `--force` is required, rather than surfacing only the raw stderr.

#### Scenario: Remove dirty worktree

- **WHEN** the `worktree remove` action is invoked on a worktree with modified or untracked files and `force` is false
- **THEN** the system returns `ok: false` with an error message and a flag indicating `--force` is required
