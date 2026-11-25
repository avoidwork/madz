# review-code Specification

## Purpose

Defines the `review-code` skill's behavior: a deterministic, language-agnostic code audit that classifies files by extension, applies per-language rule catalogs with fixed severities, computes a fixed-weight health score and grade, and files one issue per target. This change adds selectable input targeting — a pull request, pending working-tree changes, a named path, or the default directory-tree discovery — to the skill's Phase 0 discovery.

## Requirements

### Requirement: Input target parsing
The skill SHALL parse the text after `/review-code` into exactly one of four modes: PR mode (`pr <number>`), pending-changes mode (`pending`, `--staged`, `--unstaged`), path mode (a single file or directory), or default mode (no target).

#### Scenario: PR mode is selected
- **WHEN** the user invokes `/review-code pr 42`
- **THEN** the skill selects PR mode with PR number 42

#### Scenario: Pending-changes mode is selected
- **WHEN** the user invokes `/review-code pending`
- **THEN** the skill selects pending-changes mode

#### Scenario: Path mode is selected
- **WHEN** the user invokes `/review-code src/tools/web`
- **THEN** the skill selects path mode with target `src/tools/web`

#### Scenario: Default mode is selected
- **WHEN** the user invokes `/review-code` with no target
- **THEN** the skill selects default mode and preserves the existing directory-tree discovery

### Requirement: PR mode file-set derivation
In PR mode the skill SHALL derive the changed-file list via `gh pr view <number> --json files` and may use `gh pr diff <number>` for context, then build the phase queue from that file set.

#### Scenario: PR with changed source files
- **WHEN** PR 42 has changed source files
- **THEN** the skill audits exactly those files and produces one issue for the PR

#### Scenario: PR with no changed source files
- **WHEN** PR 42 has no changed source files
- **THEN** the skill reports "nothing to audit" and produces no issue

### Requirement: Pending-changes mode file-set derivation
In pending-changes mode the skill SHALL derive changed files via `git diff --staged --name-only` and/or `git diff --name-only` and build the phase queue from that file set.

#### Scenario: Pending changes present
- **WHEN** the working tree has staged and/or unstaged changes
- **THEN** the skill audits exactly those changed files and produces one issue for the pending changes

#### Scenario: Clean working tree
- **WHEN** pending-changes mode is selected and the working tree is clean
- **THEN** the skill reports "nothing to audit" and produces no issue

### Requirement: Path mode file-set derivation
In path mode the skill SHALL accept a single directory OR a single file as the target and build the phase queue from just that path.

#### Scenario: Path is a directory
- **WHEN** the user invokes `/review-code src/tools/web` and that path is a directory
- **THEN** the skill audits that directory and produces one issue for the path

#### Scenario: Path is a single file
- **WHEN** the user invokes `/review-code src/tools/web/index.js` and that path is a file
- **THEN** the skill audits that file and produces one issue for the path

#### Scenario: Path does not exist
- **WHEN** the target path does not exist
- **THEN** the skill skips with a warning and produces no issue

### Requirement: Input validation
The skill SHALL validate the target argument before use: a PR number must be numeric, a path must exist and be within the repo, and `file://`, `gopher://`, and `dict://` scheme inputs must be rejected.

#### Scenario: Non-numeric PR number is rejected
- **WHEN** the user invokes `/review-code pr abc`
- **THEN** the skill rejects the input as an invalid PR number

#### Scenario: Unsafe URL scheme is rejected
- **WHEN** the target argument begins with `file://`, `gopher://`, or `dict://`
- **THEN** the skill rejects the input

#### Scenario: Path outside the repo is rejected
- **WHEN** the target path resolves outside the repository root
- **THEN** the skill rejects the input

### Requirement: Default directory-tree discovery preserved
When no target is given the skill SHALL preserve the existing `find . -maxdepth 2` directory-tree discovery within the cwd, excluding common non-source patterns, and produce one issue per discovered source directory.

#### Scenario: No target yields the existing behavior
- **WHEN** the user invokes `/review-code` with no target
- **THEN** the phase queue is identical to the v2.5.0 directory-tree discovery

### Requirement: Deterministic invariants preserved across modes
Across all modes the skill SHALL preserve language classification by extension, the per-language rule catalogs, the fixed scoring weights (critical 25 / high 10 / medium 4 / low 1), the fixed grade bands (A–F), one issue per target, and the security gotcha that audit findings never include raw secret values.

#### Scenario: Finding table contains no secret values
- **WHEN** the skill writes an audit table for any mode
- **THEN** the table contains only rule ID, file, severity, and count — never matched line content

#### Scenario: Score and grade are mode-independent
- **WHEN** the same findings are produced under any mode
- **THEN** the computed score and grade are identical

### Requirement: Frontmatter advertises the input modes
The skill's frontmatter SHALL set `metadata.version` to 2.6.0 and extend `description` to mention the PR, pending-changes, and path input modes plus the preserved default.

#### Scenario: Version and description updated
- **WHEN** the skill frontmatter is read
- **THEN** `metadata.version` is 2.6.0 and `description` references the three input modes and the default
