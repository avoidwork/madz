# Bundled Skills

The skills that ship with madz in `.skills/`. Each is an [Agent Skills](https://agentskills.io/specification)-spec-compliant `SKILL.md` that the orchestrator loads on demand via the `skill` tool. They are scanned first and shadow user skills of the same name in `skills/`.

## How Skills Work

Skills are instruction files interpreted by the agent — they are not spawned into a separate process. When a task matches a skill's `description`, the orchestrator loads the full `SKILL.md` body and follows its workflow. A skill can carry an optional `scripts/` directory with executable helpers (`.py`, `.sh`, `.js`, `.rb`, `.ts`).

Skills are grouped by the agent that owns them (declared in frontmatter `metadata.agent`). The catalog below groups them by workflow domain.

## Git & Release Workflow

| Skill | Description |
|-------|-------------|
| `commit-push` | Automates the complete git workflow: scans project rules for conventions, stages all changes, commits, pushes to the remote, and opens a Pull Request. Ensures strict compliance with documentation rules, including rule 5.4. |
| `git-tag` | Reads version from `package.json` (Node.js), `pyproject.toml` (Python), `Cargo.toml` (Rust), `build.gradle` (Java/Android), `pom.xml` (Maven), `build.gradle.kts` (Gradle Kotlin), `pubspec.yaml` (Dart), `Gemfile` (Ruby), or similar package manager files. Synthesizes a change description from git history delta, creates an annotated git tag (no `v` prefix), and pushes it to origin. |
| `update-semver` | Audits the delta between HEAD and the tag matching the current `package.json` version, decides if it's a major/minor/patch bump, updates `package.json`, runs `npm i` and `npm run changelog`, then triggers commit-push, enables auto-merge on the PR, and announces the new version. Does NOT create a git tag — that is handled by the separate `git-tag` skill after the PR merges. |
| `release-madz` | Builds and pushes all Docker images for the madz project by running `npm run docker:release:all`. Runs the build as a background process with a 30-minute timeout. Reports completion status to the user. NOT retryable — Docker image tags are immutable, so a failed run cannot be re-run against the same version. |
| `purge-branches` | Deletes all local git branches except `main`. Works in any git repository — no npm or `package.json` dependency. |
| `update-pr` | Update an existing PR's title and description by scanning project rules for conventions and the PR template, synthesizing both from the delta between the branch and target, then applying changes via `gh api` (`gh pr edit` fails in this repo). |

## Issue & Feature Lifecycle

| Skill | Description |
|-------|-------------|
| `create-issue` | Receives a user description, synthesizes it into a title and description, categorizes as `fix` or `feat`, creates a GitHub issue, audits the codebase for actionable details, and updates the issue with findings. |
| `fix-issue` | Accepts a GitHub issue ID, validates approval via labels, categorizes the work, chains to `/create-feature` for full implementation, and comments on the issue linking to the PR. |
| `create-feature` | Orchestrates a complete feature lifecycle: receive goals, synthesize specs, propose via OpenSpec, commit specs to PR, apply tasks, commit implementation, archive, update PR, and post audit results. Creates an isolated git worktree for each run. |
| `scan-issues` | Scans GitHub for open issues labeled `approved` (excluding those also labeled `in progress`), processes them via `fix-issue`, opens PRs with auto-merge, and resolves merge conflicts. Runs hourly. |

## OpenSpec Workflow

| Skill | Description |
|-------|-------------|
| `openspec-propose` | Propose a new change with all artifacts generated in one step. Use when the user wants to quickly describe what they want to build and get a complete proposal with design, specs, and tasks ready for implementation. |
| `openspec-apply-change` | Implement tasks from an OpenSpec change. Use when the user wants to start implementing, continue implementation, or work through tasks. |
| `openspec-archive-change` | Archive a completed change in the experimental workflow. Use when the user wants to finalize and archive a change after implementation is complete. |
| `openspec-explore` | Enter explore mode — a thinking partner for exploring ideas, investigating problems, and clarifying requirements. Use when the user wants to think through something before or during a change. |

## Audit & Review

| Skill | Description |
|-------|-------------|
| `audit-code` | Audits each directory in `./src` for bugs, security vulnerabilities, and performance issues. Generates one consolidated issue per directory via `/create-issue`. |
| `audit-skill` | Audits Agent Skills `SKILL.md` files against the protocol specification and best practices. Identifies issues across 10 categories: schema violations, naming, description quality, structure, progressive disclosure, file references, best practices, calibration, content quality, and optional directories. Produces a structured report with severity levels and actionable fixes. |
| `audit-sys-prompt` | Expert System Prompt Evaluator Agent. Analyzes, rates, and provides actionable feedback for system prompts against a 7-criteria framework. Returns structured machine-readable JSON output with weighted scores, evidence-based reasoning, and harness-aware recommendations. |
| `restructure-code` | Audits each directory in `./src` for opportunities to restructure directories to align with community best practices & better organization in general. Generates one consolidated issue per directory via `/create-issue`. |

## Reflection

| Skill | Description |
|-------|-------------|
| `reflection` | Generate a narrative reflection summary from recent session history to capture mood, energy, and interaction quality. |

## Invoking a Skill

Skills are invoked by the orchestrator when a task matches the skill's `description`. They can also be triggered directly from a message (e.g., `/commit-push`) or scheduled via the cron system (`node index.js --message "Run the reflection skill"`).

## Adding a Skill

See [DEVELOPMENT.md](./DEVELOPMENT.md) for how to create skills programmatically via the `createSkill` tool or manually under `skills/`. Bundled skills live in `.skills/` and are committed to the repo.
