# Design

## Context

See proposal.md - Why. The `git` tool (`src/tools/git/index.js`) routes all operations through a single `action` switch. The relevant cases are `branch` (list/delete), `worktree` (add/remove/list/prune), and `checkout` (create via `-b`). All git commands run through `runGit(args, cwd)` which uses `execFile("git", [args])` — never a shell string.

## Goals / Non-Goals

**Goals:**
- Add an `existing` flag to `worktree add` for linking to an existing branch.
- Return a structured `worktree` hint on branch-delete blocked by a worktree.
- Add a `create` path to the `branch` action supporting a start ref.
- Return a structured hint on dirty-worktree removal.

**Non-Goals:**
- Auto-removing a worktree when a branch delete is blocked. The tool returns a hint; removal is explicit.
- Auto-detecting branch existence in `worktree add`. The `existing` flag is explicit.
- Changing the `checkout` action's existing `-b` behavior.

## Decisions

### Decision 1: Explicit `existing` flag over auto-detection

**Choice:** Add an `existing: boolean` input flag to `worktree add`. When true and `branch` is set, emit `git worktree add <path> <branch>`.

**Alternatives considered:**
- Auto-detect branch existence via a `git branch` call before deciding. Rejected: requires an extra round-trip and can race; explicit is predictable and matches the issue's "add an `existing` flag" guidance.

**Rationale:** The flag is explicit, deterministic, and keeps the existing `-b` create path unchanged.

### Decision 2: Structured worktree hint, not auto-removal

**Choice:** In `branch` delete, detect the `cannot delete branch ... used by worktree` stderr pattern and return `{ ok: false, error, worktree: "<path>" }`.

**Alternatives considered:**
- Auto-remove the worktree before deleting. Rejected: destructive and surprising; removal should be an explicit caller decision.
- Surface raw stderr. Rejected: no diagnostic that a worktree is the cause.

**Rationale:** The structured `worktree` field gives the caller a precise cause without side effects.

### Decision 3: `create` flag on the `branch` action

**Choice:** Add a `create: boolean` flag to the `branch` action. When true, emit `git branch <name> <start-ref>`.

**Alternatives considered:**
- Extend `checkout -b` to accept a start ref. Rejected: `checkout -b <branch> <ref>` is valid git, but the issue explicitly asks for a standalone branch-create action and keeping it on `branch` keeps the action surface cohesive.

**Rationale:** The `branch` action already owns branch operations; adding `create` keeps branch lifecycle logic in one place.

### Decision 4: Dirty-worktree hint on `worktree remove`

**Choice:** Detect the dirty-worktree stderr pattern and return a structured hint that `--force` is required.

**Rationale:** Mirrors the branch-delete hint pattern; the existing `force` flag already works, so this only improves the error signal.

## Risks / Trade-offs

- [Stderr pattern matching is brittle across git versions] → Match on the stable substrings `used by worktree` and `contains modified or untracked files`; fall back to raw stderr if the pattern is not found.
- [New `existing`/`create` flags could be misused] → Both are additive and validated by the existing Zod schema; no existing behavior changes.

## Migration Plan

No migration. All changes are additive to existing actions. Rollback is a revert of the git tool change.

## Open Questions

None.
