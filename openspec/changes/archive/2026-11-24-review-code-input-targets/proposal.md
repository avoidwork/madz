# Proposal

## Why

The `review-code` skill (`.skills/review-code/SKILL.md`, v2.5.0) has exactly one input: the directory tree discovered in the cwd via `find . -maxdepth 2`. This forces a full-tree audit and makes it impossible to review a specific pull request's changed files, pending working-tree changes, or a single named path. Supporting these three input modes makes the skill usable in CI, pre-merge, and surgical local workflows.

## What Changes

- Add a target-argument parser to Phase 0 (Discovery) that classifies the text after `/review-code` into one of four modes:
  - **PR mode** (`/review-code pr 42`): derive the changed-file list via `gh pr view <number> --json files` (and `gh pr diff <number>` for context). One issue per PR.
  - **Pending-changes mode** (`/review-code pending`, `--staged`, `--unstaged`): derive changed files via `git diff --staged --name-only` and/or `git diff --name-only`. One issue for the pending changes.
  - **Path mode** (`/review-code src/tools/web` or `/review-code src/tools/web/index.js`): accept a single directory OR a single file. One issue for the path.
  - **Default (unchanged)** (`/review-code` with no target): fall back to the existing `find . -maxdepth 2` directory-tree discovery.
- Validate input before use: PR number must be numeric; path must exist and be within the repo; reject `file://`/`gopher://`/`dict://` scheme inputs.
- Handle edge cases: a PR with no changed source files, a clean working tree in pending mode, and a non-existent path each report "nothing to audit" (or skip with a warning) rather than failing.
- Bump `metadata.version` from 2.5.0 to 2.6.0 and extend `description` to advertise the three input modes plus the preserved default.

**Non-goals:**

- No changes to the 8 per-language rule catalogs in `references/` (reused unchanged).
- No changes to language classification, scoring weights (critical 25 / high 10 / medium 4 / low 1), grade bands (A–F), or the "never write raw secret values into the issue body" gotcha.
- No new npm packages. No new tools.

## Capabilities

### New Capabilities

- `review-code`: the deterministic code-audit skill — language classification by extension, per-language rule catalogs, fixed scoring/grade, one issue per target, and the security gotcha. This change adds selectable input targeting (PR / pending / path / default) to the skill's Phase 0 discovery.

### Modified Capabilities

<!-- none: no existing spec-level requirement changes; the review-code skill has no prior spec -->

## Impact

- **Code:** `.skills/review-code/SKILL.md` (Phase 0 discovery + frontmatter). The only file that must change.
- **Dependencies:** git CLI (pending mode) and gh CLI (PR mode) — both already required. No new packages.
- **Behavior:** additive — the directory-tree discovery path is preserved as the default, so existing behavior is unchanged when no target is given.
