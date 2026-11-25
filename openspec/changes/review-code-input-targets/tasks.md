# Tasks

## 1. Phase 0 target parser

- [x] 1.1 Add a target-argument parser as the first step of Phase 0 in `.skills/review-code/SKILL.md` that classifies the text after `/review-code` into PR mode (`pr <number>`), pending-changes mode (`pending`/`--staged`/`--unstaged`), path mode (file or directory), or default mode (empty). Verify by reading the updated Phase 0 and confirming all four modes are described with their grammar.
- [x] 1.2 Add input validation to the parser: PR number must match `^[0-9]+$`, a path must exist and resolve within the repo root, and `file://`/`gopher://`/`dict://` scheme inputs are rejected. Verify by confirming the validation rules are written into Phase 0.

## 2. File-set derivation per mode

- [x] 2.1 Implement PR mode: derive the changed-file list via `gh pr view <number> --json files` (and `gh pr diff <number>` for context) and build the phase queue from that file set; one issue per PR. Verify by confirming the PR-mode derivation block is present and references the correct `gh` commands.
- [x] 2.2 Implement pending-changes mode: derive changed files via `git diff --staged --name-only` and/or `git diff --name-only` and build the phase queue from that file set; one issue for the pending changes. Verify by confirming the pending-mode derivation block is present and references the correct `git` commands.
- [x] 2.3 Implement path mode: accept a single directory OR a single file and build the phase queue from just that path; one issue for the path. Verify by confirming the path-mode derivation block handles both file and directory targets.
- [x] 2.4 Preserve default mode: when no target is given, keep the existing `find . -maxdepth 2` directory-tree discovery unchanged. Verify by diffing the default branch against v2.5.0 and confirming it is byte-identical.

## 3. Edge cases and invariants

- [x] 3.1 Handle edge cases: a PR with no changed source files, a clean working tree in pending mode, and a non-existent path each report "nothing to audit" (or skip with a warning) rather than failing. Verify by confirming each edge case is documented in Phase 0 / Error Handling.
- [x] 3.2 Preserve deterministic invariants across all modes: language classification by extension, the 8 per-language catalogs in `references/` reused unchanged, fixed scoring weights (critical 25 / high 10 / medium 4 / low 1), fixed grade bands (A–F), one issue per target, and the "never write raw secret values into the issue body" gotcha. Verify by confirming `references/` is untouched and the invariants are stated in the skill.

## 4. Frontmatter

- [x] 4.1 Bump `metadata.version` to 2.6.0 and extend `description` to mention the PR, pending-changes, and path input modes plus the preserved default. Verify by reading the frontmatter and confirming version 2.6.0 and the three modes are present.

## 5. Verification

- [x] 5.1 Run each mode against a fixture (a PR with known changed files, a dirty working tree, a named path) and confirm one issue per target with the expected findings; confirm the default path is unchanged. Verify by executing the four invocations and checking the resulting phase queues.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
