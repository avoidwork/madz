# Design

## Context

See proposal.md - Why. The git tool (`src/tools/git/index.js`) wraps `execFile("git", [args])` and routes on an `action` parameter. The `worktree add`, `branch`, and `worktree remove` cases have gaps that block common workflows. This is a single-module change with no new dependencies.

## Goals / Non-Goals

**Goals:**
- Add an `existing` flag to `worktree add` for attaching to an existing branch.
- Detect "used by worktree" in `branch -d`/`-D` and return a structured hint.
- Add a `create` flag to `branch` for standalone branch creation.
- Detect "contains modified or untracked files" in `worktree remove` and return a structured hint.

**Non-Goals:**
- Not changing `options.cwd` resolution (framework-level, tracked separately).
- Not adding path validation for `worktree add`.
- Not changing `checkout -b`.

## Decisions

### Decision 1: Explicit `existing` flag on `worktree add`

The `worktree add` case currently branches on whether `input.branch` is set. We add an explicit `existing` boolean. When `existing` is true, emit `git worktree add <path> <branch>` (no `-b`, no `--detach`). When `existing` is false and `branch` is set, keep `-b <branch>`. When neither, keep `--detach`.

**Alternative considered:** Inferring "existing" by checking whether the branch already exists (e.g., via `git branch --list`). Rejected because it adds a round-trip and is ambiguous when the branch name is new but the agent wants it created. Explicit is predictable.

### Decision 2: Structured error detection by matching git stderr

For `branch -d`/`-D` and `worktree remove`, detect known git stderr patterns and return structured hints rather than raw stderr.

- `branch` delete: match `/cannot delete branch .* used by worktree at '(.+)'/` → return `{ ok: false, error, worktreePath }`.
- `worktree remove`: match `/contains modified or untracked files/` → return `{ ok: false, error, requiresForce: true }`.

**Alternative considered:** Auto-removing the worktree first when `force` is set. Rejected for now — it's a destructive side effect that should be explicit. The structured hint lets the agent decide.

### Decision 3: `create` flag on `branch`

Add a `create` path to the `branch` action. When `create` is true, emit `git branch <name> [<start-ref>]`. This is distinct from `checkout -b`, which switches to the branch. The `create` flag and `delete` flag are mutually exclusive.

## Risks / Trade-offs

- **[Matching git stderr is brittle across versions]** → The patterns (`used by worktree`, `contains modified or untracked files`) are stable in modern git. If a pattern changes, the fallback is the existing raw-stderr path, so the tool still returns a usable error.
- **[`existing` flag adds schema surface]** → Keeps behavior explicit and predictable; the cost is one optional boolean.

## Migration Plan

No migration. This is a backward-compatible additive change. Existing actions retain their behavior.

## Open Questions

None.
