# Design

## Context

The `git` tool (`src/tools/git/index.js`) is a single LangChain `tool()` wrapper around `gitImpl(input, options)`, which dispatches on `action` to `execFile("git", [args])`. The tool already supports `worktree` (add/remove/list/prune), `branch` (list/delete), and `checkout` (with `-b`). The gaps are all localized to the `worktree add`, `branch`, and `worktree remove` cases plus the cwd resolution line. No new dependencies are required; the fix reuses the existing `execFile("git", [args])` pattern and the `getProjectCwd()` helper.

## Goals / Non-Goals

**Goals:**
- Allow `worktree add` to link to an existing branch (`git worktree add <path> <existing-branch>`).
- Return a structured hint when `branch -d`/`-D` fails because the branch is checked out in a worktree.
- Add a standalone `branch` create action (`git branch <name> <start-ref>`) that does not switch HEAD.
- Return a structured hint when `worktree remove` fails on a dirty worktree (`--force` required).
- Validate `worktree add` paths to reject nested-worktree footguns.
- Clarify that `options.cwd` is a direct-call-only override, not a production path.

**Non-Goals:**
- No auto-removal of worktrees on branch delete.
- No auto-`--force` on dirty worktree removal.
- No changes to `checkout`, `merge`, `rebase`, or other git actions.
- No changes to the `git` tool's registration in `src/tools/index.js`.

## Decisions

**Decision 1: Explicit `existing` flag for `worktree add` (not auto-detect).**
- Rationale: An explicit `existing: true` flag keeps the tool deterministic and avoids a `git branch` round-trip to detect whether the branch already exists. The caller knows whether they want to link to an existing branch or create a new one.
- Alternative considered: auto-detect by running `git branch` first — rejected for the extra round-trip and a race between detection and the add.

**Decision 2: Structured `hint` on failure, not auto-fix.**
- Rationale: For F2 (branch delete used by worktree) and F5 (dirty worktree remove), auto-removing the worktree or auto-forcing is destructive and could surprise the caller. Returning `{ ok: false, error, hint }` surfaces the cause and the remedy without taking a destructive action.
- Alternative considered: auto-remove the worktree before deleting the branch — rejected as destructive and surprising.

**Decision 3: `git branch <name>` for standalone create (no HEAD switch).**
- Rationale: `git branch <name>` creates a branch without switching, which is the correct standalone-create semantics. `checkout -b` switches HEAD, which is a different operation. The new `branch` create path supports an optional start ref (`git branch <name> <ref>`).
- Alternative considered: extending `checkout -b` to accept a start ref — rejected because `checkout` switches HEAD, which is not the standalone-create intent.

**Decision 4: Tolerant regex for stderr matching.**
- Rationale: Git's stderr text varies across versions (e.g., "cannot delete branch 'x' used by worktree at '<path>'" vs. "contains modified or untracked files"). Use tolerant regexes that match the stable substrings rather than exact text.
- Alternative considered: exact string match — rejected as brittle across git versions.

**Decision 5: Path validation via repo root detection.**
- Rationale: Reject `worktree add` paths that resolve inside the current repo working tree, preventing the nested-worktree footgun. Use `git rev-parse --show-toplevel` (via the existing `rev-parse` path or a direct call) to detect nesting.
- Alternative considered: no validation — rejected because the issue explicitly calls out the nested-worktree risk.

## Risks / Trade-offs

- **[Risk] `existing` flag requires caller knowledge.** The caller must know whether the branch already exists. Mitigation: the flag is documented in the schema; the `-b` path remains for new branches.
- **[Risk] Regex brittleness.** Git stderr text may change. Mitigation: match stable substrings ("used by worktree", "contains modified or untracked files") rather than exact text; fall back to the raw error if no match.
- **[Risk] Path validation false positives.** A sibling worktree path (outside the repo) must not be rejected. Mitigation: only reject paths that resolve inside the repo working tree.
- **[Risk] F3 is a documentation/accuracy fix.** The production resolution path is unchanged; only the JSDoc and test are corrected to reflect that `options.cwd` is a direct-call-only override.
