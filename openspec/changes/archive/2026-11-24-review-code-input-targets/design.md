# Design

## Context

The `review-code` skill (`.skills/review-code/SKILL.md`, v2.5.0) is a deterministic, language-agnostic code audit. Its Phase 0 (Discovery) is the single point of file-set derivation: today it runs `find . -maxdepth 2` over the cwd (excluding `node_modules`, `.git`, `tests`, etc.) to build the phase queue, then the directory-processing loop classifies each file by extension, loads the per-language catalog from `references/`, runs every rule, computes a fixed-weight score, assigns a grade, and files one issue per directory via `create-issue`.

See proposal.md for motivation. This design covers how to add selectable input targeting to Phase 0 without disturbing the deterministic audit method.

## Goals / Non-Goals

**Goals:**
- Add a target-argument parser as the first step of Phase 0 that routes to one of four file-set derivations: PR, pending-changes, path, or default.
- Keep the deterministic audit method (classification, catalogs, scoring, grade, one-issue-per-target, secret-value gotcha) identical across all modes.
- Preserve the existing directory-tree discovery as the default when no target is given.

**Non-Goals:**
- No changes to the 8 per-language rule catalogs in `references/`.
- No changes to scoring weights, grade bands, language classification, or the secret-value gotcha.
- No new npm packages or tools.

## Decisions

### Decision 1: A single parser at the top of Phase 0, not separate skills
The parser classifies the text after `/review-code` into one of four modes and routes to the corresponding file-set derivation. The audit engine (classification → catalog → rules → score → grade → issue) is shared unchanged.

- **Rationale:** The audit engine is identical across modes; only the file-set derivation differs. A single skill with a selectable target is DRY and keeps the deterministic method in one place.
- **Alternatives considered:** Separate skills (`review-pr`, `review-pending`, `review-path`) — rejected as duplicative. "Always audit the whole tree" — rejected as too broad and slow for pre-merge and surgical workflows.

### Decision 2: Mode precedence and grammar
The parser reads the first token after `/review-code`:
- `pr` → next token must be a numeric PR number → PR mode.
- `pending`, `--staged`, `--unstaged` → pending-changes mode.
- Any other token that resolves to an existing path within the repo → path mode (file or directory).
- Empty → default mode (existing `find . -maxdepth 2`).

Validation runs before derivation: PR number must match `^[0-9]+$`; a path must exist and resolve within the repo root; inputs beginning with `file://`, `gopher://`, or `dict://` are rejected.

### Decision 3: File-set derivation per mode
- **PR mode:** `gh pr view <number> --json files` yields the changed-file list; `gh pr diff <number>` provides context. Build the phase queue from that file set. One issue per PR.
- **Pending-changes mode:** `git diff --staged --name-only` and/or `git diff --name-only` yield the changed files. Build the phase queue from that file set. One issue for the pending changes.
- **Path mode:** accept a single directory OR a single file; build the phase queue from just that path. One issue for the path.
- **Default mode:** unchanged `find . -maxdepth 2` directory-tree discovery.

### Decision 4: Edge cases report "nothing to audit"
A PR with no changed source files, a clean working tree in pending mode, and a non-existent path each report "nothing to audit" (or skip with a warning) rather than failing or producing an empty issue.

### Decision 5: Frontmatter bump
Bump `metadata.version` to 2.6.0 and extend `description` to advertise the three input modes plus the preserved default.

## Risks / Trade-offs

- [PR/pending modes shell out to `git`/`gh` using the user's existing credentials] → No new secrets introduced; both CLIs are already required.
- [A path that is a single file vs. a directory] → Both are accepted; the phase queue holds one entry either way.
- [Default behavior drift] → The default branch is the existing `find . -maxdepth 2` code path, unchanged, so existing behavior is preserved when no target is given.
- [Secret leakage via PR/pending diff context] → The existing gotcha holds: only rule ID, pattern type, and count are written to the issue body, never matched line content.

## Migration Plan

Additive change to a single skill file. No data migration. Rollback is reverting `.skills/review-code/SKILL.md` to v2.5.0. No external dependency changes.

## Open Questions

None.
